import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearPublicacionDto } from './dto/crear-publicacion.dto';
import { ActualizarPublicacionDto } from './dto/actualizar-publicacion.dto';
import { ConfirmarAsistenciaEventoDto } from './dto/confirmar-asistencia-evento.dto';

// Reglas de asistencia a un EVENTO (charla/capacitación/actividad, no ruta):
// un evento dura más que la simple "llegada" de una rodada, así que la
// ventana es más amplia; y el check-in por GPS es a un punto fijo (no una
// ruta), así que el radio es más ajustado que RADIO_ASISTENCIA_KM de rodadas.
const VENTANA_ANTES_EVENTO_MIN = 15;
const VENTANA_DESPUES_EVENTO_MIN = 120;
const RADIO_CHECKIN_EVENTO_KM = 0.3;

@Injectable()
export class PublicacionesService {
  constructor(private prisma: PrismaService) {}

  // Mismo patrón que mapa.service.ts (no se comparte entre módulos, ver
  // criterio ya usado en RecordatoriosScheduler).
  private combinarFechaHora(
    fecha: string | null,
    hora: string | null,
  ): Date | null {
    if (!fecha) return null;
    const d = new Date(`${fecha}T${hora ?? '00:00'}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private distanciaHaversineKm(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
  ): number {
    const radioTierraKm = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return radioTierraKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  private estaVencida(publicacion: {
    duracionHoras: number | null;
    createdAt: Date;
  }) {
    if (!publicacion.duracionHoras) return false;
    const expiraEn =
      publicacion.createdAt.getTime() +
      publicacion.duracionHoras * 60 * 60 * 1000;
    return Date.now() > expiraEn;
  }

  private formatear<T extends { fotos: string | null }>(p: T) {
    return { ...p, fotos: p.fotos ? (JSON.parse(p.fotos) as string[]) : [] };
  }

  async listar() {
    const publicaciones = await this.prisma.publicacion.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const vigentes = publicaciones.filter((p) => !this.estaVencida(p));
    const ids = vigentes.map((p) => p.id);

    const rsvps = ids.length
      ? await this.prisma.rsvpRespuesta.findMany({
          where: { publicacionId: { in: ids } },
        })
      : [];

    return vigentes.map((p) => {
      const propios = rsvps.filter((r) => r.publicacionId === p.id);
      return {
        ...this.formatear(p),
        rsvpCounts: {
          yes: propios.filter((r) => r.estado === 'yes').length,
          maybe: propios.filter((r) => r.estado === 'maybe').length,
          no: propios.filter((r) => r.estado === 'no').length,
        },
      };
    });
  }

  async misRsvps(miembroId: number) {
    const respuestas = await this.prisma.rsvpRespuesta.findMany({
      where: { miembroId },
    });
    return Object.fromEntries(
      respuestas.map((r) => [r.publicacionId, r.estado]),
    );
  }

  async detalleRsvps(publicacionId: number) {
    await this.obtenerOFallar(publicacionId);
    const respuestas = await this.prisma.rsvpRespuesta.findMany({
      where: { publicacionId },
      include: { miembro: { select: { nombre: true } } },
      orderBy: { actualizadoEn: 'desc' },
    });
    return respuestas.map((r) => ({
      miembroNombre: r.miembro.nombre,
      estado: r.estado,
    }));
  }

  async crear(dto: CrearPublicacionDto) {
    const { fotos, ...resto } = dto;
    const creada = await this.prisma.publicacion.create({
      data: { ...resto, fotos: fotos ? JSON.stringify(fotos) : undefined },
    });
    return this.formatear(creada);
  }

  async actualizar(id: number, dto: ActualizarPublicacionDto) {
    await this.obtenerOFallar(id);
    const { fotos, ...resto } = dto;
    const actualizada = await this.prisma.publicacion.update({
      where: { id },
      data: { ...resto, ...(fotos ? { fotos: JSON.stringify(fotos) } : {}) },
    });
    return this.formatear(actualizada);
  }

  async eliminar(id: number) {
    await this.obtenerOFallar(id);
    await this.prisma.rsvpRespuesta.deleteMany({
      where: { publicacionId: id },
    });
    await this.prisma.asistenciaEvento.deleteMany({
      where: { publicacionId: id },
    });
    await this.prisma.publicacion.delete({ where: { id } });
    return { mensaje: 'Publicación eliminada' };
  }

  async marcarRsvp(publicacionId: number, miembroId: number, estado: string) {
    await this.obtenerOFallar(publicacionId);
    return this.prisma.rsvpRespuesta.upsert({
      where: { publicacionId_miembroId: { publicacionId, miembroId } },
      create: { publicacionId, miembroId, estado },
      update: { estado },
    });
  }

  async misAsistenciasEvento(miembroId: number) {
    const asistencias = await this.prisma.asistenciaEvento.findMany({
      where: { miembroId },
      select: { publicacionId: true },
    });
    return Object.fromEntries(asistencias.map((a) => [a.publicacionId, true]));
  }

  async confirmarAsistenciaEvento(
    miembroId: number,
    publicacionId: number,
    dto: ConfirmarAsistenciaEventoDto,
  ) {
    const publicacion = await this.obtenerOFallar(publicacionId);
    if (publicacion.tipo !== 'evento' || !publicacion.tipoAsistenciaEvento) {
      throw new BadRequestException(
        'Esta publicación no admite confirmar asistencia',
      );
    }
    if (publicacion.tipoAsistenciaEvento === 'cierre_manual') {
      throw new BadRequestException(
        'Tu asistencia a este evento la confirma un organizador en el lugar',
      );
    }

    const rsvp = await this.prisma.rsvpRespuesta.findUnique({
      where: { publicacionId_miembroId: { publicacionId, miembroId } },
    });
    if (!rsvp || !['yes', 'maybe'].includes(rsvp.estado)) {
      throw new BadRequestException('Primero confirma tu RSVP (Voy o Tal vez)');
    }

    const fechaHora = this.combinarFechaHora(
      publicacion.fecha,
      publicacion.hora,
    );
    if (!fechaHora) {
      throw new BadRequestException(
        'Este evento no tiene fecha y hora definidas',
      );
    }
    const desde = fechaHora.getTime() - VENTANA_ANTES_EVENTO_MIN * 60 * 1000;
    const hasta = fechaHora.getTime() + VENTANA_DESPUES_EVENTO_MIN * 60 * 1000;
    const ahora = Date.now();
    if (ahora < desde || ahora > hasta) {
      throw new BadRequestException('Fuera de la ventana horaria del evento');
    }

    if (publicacion.tipoAsistenciaEvento === 'codigo') {
      const esperado = (publicacion.codigoAsistencia ?? '')
        .trim()
        .toLowerCase();
      const recibido = (dto.codigo ?? '').trim().toLowerCase();
      if (!esperado || recibido !== esperado) {
        throw new BadRequestException('Código incorrecto');
      }
    } else if (publicacion.tipoAsistenciaEvento === 'gps_puntual') {
      if (publicacion.puntoLat === null || publicacion.puntoLon === null) {
        throw new BadRequestException(
          'Este evento no tiene un punto de ubicación definido',
        );
      }
      if (dto.lat === undefined || dto.lon === undefined) {
        throw new BadRequestException(
          'Se requiere tu ubicación para confirmar asistencia',
        );
      }
      const distancia = this.distanciaHaversineKm(
        { lat: publicacion.puntoLat, lon: publicacion.puntoLon },
        { lat: dto.lat, lon: dto.lon },
      );
      if (distancia > RADIO_CHECKIN_EVENTO_KM) {
        throw new BadRequestException(
          'Debes estar en el lugar del evento para confirmar',
        );
      }
    }

    await this.prisma.asistenciaEvento.upsert({
      where: { publicacionId_miembroId: { publicacionId, miembroId } },
      create: { publicacionId, miembroId },
      update: {},
    });
    return { mensaje: 'Asistencia confirmada' };
  }

  async listarParaRollCall(publicacionId: number) {
    await this.obtenerOFallar(publicacionId);
    const respuestas = await this.prisma.rsvpRespuesta.findMany({
      where: { publicacionId, estado: { in: ['yes', 'maybe'] } },
      include: { miembro: { select: { id: true, nombre: true } } },
      orderBy: { actualizadoEn: 'desc' },
    });
    const asistencias = await this.prisma.asistenciaEvento.findMany({
      where: { publicacionId },
      select: { miembroId: true },
    });
    const asistieron = new Set(asistencias.map((a) => a.miembroId));

    return respuestas.map((r) => ({
      miembroId: r.miembro.id,
      miembroNombre: r.miembro.nombre,
      estado: r.estado,
      asistio: asistieron.has(r.miembro.id),
    }));
  }

  async alternarAsistenciaManual(publicacionId: number, miembroId: number) {
    const publicacion = await this.obtenerOFallar(publicacionId);
    if (publicacion.tipoAsistenciaEvento !== 'cierre_manual') {
      throw new BadRequestException(
        'Esta publicación no usa cierre manual de asistencia',
      );
    }

    const existente = await this.prisma.asistenciaEvento.findUnique({
      where: { publicacionId_miembroId: { publicacionId, miembroId } },
    });
    if (existente) {
      await this.prisma.asistenciaEvento.delete({
        where: { id: existente.id },
      });
      return { asistio: false };
    }
    await this.prisma.asistenciaEvento.create({
      data: { publicacionId, miembroId },
    });
    return { asistio: true };
  }

  private async obtenerOFallar(id: number) {
    const publicacion = await this.prisma.publicacion.findUnique({
      where: { id },
    });
    if (!publicacion) throw new NotFoundException('Publicación no encontrada');
    return publicacion;
  }
}
