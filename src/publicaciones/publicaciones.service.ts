import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearPublicacionDto } from './dto/crear-publicacion.dto';
import { ActualizarPublicacionDto } from './dto/actualizar-publicacion.dto';
import { ConfirmarAsistenciaEventoDto } from './dto/confirmar-asistencia-evento.dto';
import { borrarArchivoSubido } from '../common/uploads-fs.util';
import { combinarFechaHoraChile } from '../common/fecha-chile.util';

// Reglas de asistencia a un EVENTO (charla/capacitación/actividad, no ruta):
// un evento dura más que la simple "llegada" de una rodada, así que la
// ventana es más amplia; y el check-in por GPS es a un punto fijo (no una
// ruta), así que el radio es más ajustado que RADIO_ASISTENCIA_KM de rodadas.
const VENTANA_ANTES_EVENTO_MIN = 15;
const VENTANA_DESPUES_EVENTO_MIN = 120;
const RADIO_CHECKIN_EVENTO_KM = 0.3;

// Mismo criterio de "cuánto antes avisar" que MINUTOS_ANTES_RECORDATORIO en
// recordatorios.scheduler.ts (push del sistema) — pero esto es para la
// campana in-app, un sistema totalmente aparte (no depende de recordatorioEnviado
// ni de tener push activado): se calcula en vivo cada vez que se consulta.
const MINUTOS_AVISO_PROXIMA_RODADA = 30;

@Injectable()
export class PublicacionesService {
  constructor(private prisma: PrismaService) {}

  private combinarFechaHora(
    fecha: string | null,
    hora: string | null,
  ): Date | null {
    return combinarFechaHoraChile(fecha, hora);
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
      include: { _count: { select: { reacciones: true } } },
    });

    const vigentes = publicaciones.filter((p) => !this.estaVencida(p));
    const ids = vigentes.map((p) => p.id);

    const rsvps = ids.length
      ? await this.prisma.rsvpRespuesta.findMany({
          where: { publicacionId: { in: ids } },
        })
      : [];

    return vigentes.map((p) => {
      const { _count, ...resto } = p;
      const propios = rsvps.filter((r) => r.publicacionId === p.id);
      return {
        ...this.formatear(resto),
        reaccionesCount: _count.reacciones,
        rsvpCounts: {
          yes: propios.filter((r) => r.estado === 'yes').length,
          maybe: propios.filter((r) => r.estado === 'maybe').length,
          no: propios.filter((r) => r.estado === 'no').length,
        },
      };
    });
  }

  // "Me gusta" (corazón dorado) en los comunicados de Comunidad, mismo patrón
  // que PostsService.toggleReaccion/misReacciones.
  async misReacciones(miembroId: number) {
    const reacciones = await this.prisma.reaccionPublicacion.findMany({
      where: { miembroId },
      select: { publicacionId: true },
    });
    return reacciones.map((r) => r.publicacionId);
  }

  // Para la campana: la rodada (RSVP "sí" o "tal vez") que arranca dentro de
  // los próximos MINUTOS_AVISO_PROXIMA_RODADA minutos, con su punto GPS real
  // para que el frontend pueda centrar el mapa ahí al tocar el aviso. Se
  // recalcula en cada consulta (sin flag de "ya enviado") — a diferencia del
  // push del sistema, acá el aviso debe seguir visible en la campana mientras
  // la rodada no haya empezado, no dispararse una sola vez.
  async proximaRodada(miembroId: number) {
    const candidatas = await this.prisma.publicacion.findMany({
      where: {
        tipo: 'rodada',
        cerrada: false,
        rsvps: { some: { miembroId, estado: { in: ['yes', 'maybe'] } } },
      },
      select: {
        id: true,
        titulo: true,
        fecha: true,
        hora: true,
        puntoLat: true,
        puntoLon: true,
        puntoEncuentro: true,
      },
    });

    const ahora = Date.now();
    for (const c of candidatas) {
      const fechaHora = this.combinarFechaHora(c.fecha, c.hora);
      if (!fechaHora) continue;
      const minutosFaltan = (fechaHora.getTime() - ahora) / 60000;
      if (minutosFaltan > 0 && minutosFaltan <= MINUTOS_AVISO_PROXIMA_RODADA) {
        return {
          id: c.id,
          titulo: c.titulo,
          puntoLat: c.puntoLat,
          puntoLon: c.puntoLon,
          puntoEncuentro: c.puntoEncuentro,
          minutosFaltan: Math.round(minutosFaltan),
        };
      }
    }
    return null;
  }

  async toggleReaccion(publicacionId: number, miembroId: number) {
    await this.obtenerOFallar(publicacionId);
    const existente = await this.prisma.reaccionPublicacion.findUnique({
      where: { publicacionId_miembroId: { publicacionId, miembroId } },
    });

    if (existente) {
      await this.prisma.reaccionPublicacion.delete({
        where: { id: existente.id },
      });
    } else {
      await this.prisma.reaccionPublicacion.create({
        data: { publicacionId, miembroId },
      });
    }

    const total = await this.prisma.reaccionPublicacion.count({
      where: { publicacionId },
    });
    return { reaccionesCount: total, miReaccion: !existente };
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

  // fotos es un JSON array de URLs subidas por el admin al crear/editar la
  // publicación.
  private urlsArchivosPublicacion(publicacion: {
    fotos: string | null;
  }): string[] {
    if (!publicacion.fotos) return [];
    try {
      return (JSON.parse(publicacion.fotos) as string[]).filter((u) => !!u);
    } catch {
      return [];
    }
  }

  async eliminar(id: number) {
    const publicacion = await this.obtenerOFallar(id);
    await this.prisma.rsvpRespuesta.deleteMany({
      where: { publicacionId: id },
    });
    await this.prisma.asistenciaEvento.deleteMany({
      where: { publicacionId: id },
    });
    await this.prisma.reaccionPublicacion.deleteMany({
      where: { publicacionId: id },
    });
    await this.prisma.publicacion.delete({ where: { id } });
    for (const url of this.urlsArchivosPublicacion(publicacion)) {
      await borrarArchivoSubido(url);
    }
    return { mensaje: 'Publicación eliminada' };
  }

  // Borrado real (no solo el filtro de vigencia que ya aplica listar()) de
  // las publicaciones que tienen duracionHoras configurada y ya vencieron —
  // las que no tienen duracionHoras (null) son permanentes y nunca se tocan.
  // Llamado por PublicacionesLimpiezaScheduler una vez al día, mismo patrón
  // que los demás *.purgar*Vencid*() del proyecto.
  async purgarPublicacionesVencidas(): Promise<number> {
    const conVigencia = await this.prisma.publicacion.findMany({
      where: { duracionHoras: { not: null } },
      select: { id: true, fotos: true, duracionHoras: true, createdAt: true },
    });
    const vencidas = conVigencia.filter((p) => this.estaVencida(p));
    if (vencidas.length === 0) return 0;

    const ids = vencidas.map((p) => p.id);
    await this.prisma.rsvpRespuesta.deleteMany({
      where: { publicacionId: { in: ids } },
    });
    await this.prisma.asistenciaEvento.deleteMany({
      where: { publicacionId: { in: ids } },
    });
    await this.prisma.reaccionPublicacion.deleteMany({
      where: { publicacionId: { in: ids } },
    });
    await this.prisma.publicacion.deleteMany({ where: { id: { in: ids } } });

    for (const publicacion of vencidas) {
      for (const url of this.urlsArchivosPublicacion(publicacion)) {
        await borrarArchivoSubido(url);
      }
    }
    return ids.length;
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
