import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UbicacionDto } from './dto/ubicacion.dto';
import { RecorridoDto } from './dto/recorrido.dto';

const HORAS_VIGENCIA_PATINANDO = 4;
const HORAS_ESTADO = 8;
const MAX_RECORRIDOS_GUARDADOS = 10;

// Reglas de "Asistencia Confirmada" a una rodada (ajuste post-Fase 12): un
// recorrido solo genera AsistenciaRodada si el usuario marcó "Voy" antes,
// activó "Estoy en Ruta", estuvo dentro de RADIO_ASISTENCIA_KM del punto de
// inicio en la ventana horaria, y recorrió al menos DISTANCIA_MINIMA_KM.
const RADIO_ASISTENCIA_KM = 2;
const VENTANA_ANTES_ASISTENCIA_MIN = 30;
const VENTANA_DESPUES_ASISTENCIA_MIN = 20;
const DISTANCIA_MINIMA_ASISTENCIA_KM = 3;

@Injectable()
export class MapaService {
  constructor(private prisma: PrismaService) {}

  async activarPatinando(miembroId: number, dto: UbicacionDto) {
    const modo = dto.modo ?? 'patinando';
    const ubicacion = await this.prisma.ubicacionActiva.upsert({
      where: { miembroId },
      create: { miembroId, lat: dto.lat, lon: dto.lon, modo },
      update: { lat: dto.lat, lon: dto.lon, modo },
    });
    return ubicacion;
  }

  async terminarPatinando(miembroId: number) {
    await this.prisma.ubicacionActiva.deleteMany({ where: { miembroId } });
    return { mensaje: 'Dejaste de compartir tu ubicación' };
  }

  async patinandoAhora() {
    const limite = new Date(
      Date.now() - HORAS_VIGENCIA_PATINANDO * 60 * 60 * 1000,
    );
    const activos = await this.prisma.ubicacionActiva.findMany({
      where: { actualizadoEn: { gte: limite } },
      include: {
        miembro: {
          select: {
            id: true,
            nombre: true,
            fotoUrl: true,
            estadoTexto: true,
            estadoSetAt: true,
          },
        },
      },
    });

    return activos.map((u) => ({
      miembroId: u.miembro.id,
      nombre: u.miembro.nombre,
      fotoUrl: u.miembro.fotoUrl,
      estado: this.estadoVigente(u.miembro),
      lat: u.lat,
      lon: u.lon,
      modo: u.modo,
      iniciadoEn: u.iniciadoEn,
      actualizadoEn: u.actualizadoEn,
    }));
  }

  private estadoVigente(miembro: {
    estadoTexto: string | null;
    estadoSetAt: Date | null;
  }) {
    if (!miembro.estadoTexto || !miembro.estadoSetAt) return null;
    const expiraEn =
      miembro.estadoSetAt.getTime() + HORAS_ESTADO * 60 * 60 * 1000;
    if (Date.now() > expiraEn) return null;
    return miembro.estadoTexto;
  }

  // Fórmula de Haversine (mismo criterio que frontend/src/lib/geo.ts, portada
  // acá porque backend y frontend no comparten código).
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

  private combinarFechaHora(
    fecha: string | null,
    hora: string | null,
  ): Date | null {
    if (!fecha) return null;
    const d = new Date(`${fecha}T${hora ?? '00:00'}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Rodadas candidatas para el modal "Se detectó la rodada '...'. ¿Deseas
  // unirte?" al activar "Estoy en Ruta": tipo rodada, con punto de inicio
  // fijado por el Admin, con RSVP "yes" del usuario, dentro de la ventana
  // horaria de asistencia y a menos de RADIO_ASISTENCIA_KM de su posición
  // actual. Ordenadas por cercanía.
  async rodadasCercanas(miembroId: number, lat: number, lon: number) {
    const candidatas = await this.prisma.publicacion.findMany({
      where: {
        tipo: 'rodada',
        puntoLat: { not: null },
        puntoLon: { not: null },
        rsvps: { some: { miembroId, estado: 'yes' } },
      },
    });

    return candidatas
      .map((p) => {
        const fechaHora = this.combinarFechaHora(p.fecha, p.hora);
        const distanciaKm = this.distanciaHaversineKm(
          { lat, lon },
          { lat: p.puntoLat as number, lon: p.puntoLon as number },
        );
        return { p, fechaHora, distanciaKm };
      })
      .filter(({ fechaHora, distanciaKm }) => {
        if (!fechaHora || distanciaKm > RADIO_ASISTENCIA_KM) return false;
        const desde =
          fechaHora.getTime() - VENTANA_ANTES_ASISTENCIA_MIN * 60 * 1000;
        const hasta =
          fechaHora.getTime() + VENTANA_DESPUES_ASISTENCIA_MIN * 60 * 1000;
        const ahora = Date.now();
        return ahora >= desde && ahora <= hasta;
      })
      .sort((a, b) => a.distanciaKm - b.distanciaKm)
      .map(({ p, distanciaKm }) => ({
        id: p.id,
        titulo: p.titulo,
        hora: p.hora,
        distanciaKm: Math.round(distanciaKm * 100) / 100,
      }));
  }

  // Verifica las reglas de "Asistencia Confirmada" contra un recorrido ya
  // grabado (regla 1 y 2 —RSVP y modo activado— quedan implícitas: solo se
  // llega acá si el usuario ya se unió a la rodada desde el mapa). Las
  // reglas 3 (llegó al punto de inicio en la ventana horaria) son comunes a
  // todos los tipos; la regla 4 (completó la ruta) depende de
  // publicacion.tipoFinalizacion — ver TIPOS_FINALIZACION en
  // crear-publicacion.dto.ts.
  private async cumpleReglasAsistencia(
    miembroId: number,
    publicacionId: number,
    dto: RecorridoDto,
  ): Promise<boolean> {
    const publicacion = await this.prisma.publicacion.findUnique({
      where: { id: publicacionId },
    });
    if (
      !publicacion ||
      publicacion.puntoLat === null ||
      publicacion.puntoLon === null
    ) {
      return false;
    }

    const rsvp = await this.prisma.rsvpRespuesta.findUnique({
      where: { publicacionId_miembroId: { publicacionId, miembroId } },
    });
    if (!rsvp || rsvp.estado !== 'yes') return false;

    const fechaHora = this.combinarFechaHora(
      publicacion.fecha,
      publicacion.hora,
    );
    if (!fechaHora) return false;
    const desde =
      fechaHora.getTime() - VENTANA_ANTES_ASISTENCIA_MIN * 60 * 1000;
    const hasta =
      fechaHora.getTime() + VENTANA_DESPUES_ASISTENCIA_MIN * 60 * 1000;

    const puntoInicio = {
      lat: publicacion.puntoLat,
      lon: publicacion.puntoLon,
    };
    const pasoPorInicioEnVentana = dto.puntos.some(
      (punto) =>
        punto.timestamp >= desde &&
        punto.timestamp <= hasta &&
        this.distanciaHaversineKm(puntoInicio, punto) <= RADIO_ASISTENCIA_KM,
    );
    if (!pasoPorInicioEnVentana) return false;

    switch (publicacion.tipoFinalizacion) {
      case 'cierre_manual':
        return !publicacion.cerrada;

      case 'punto_llegada': {
        if (
          publicacion.puntoFinLat === null ||
          publicacion.puntoFinLon === null
        ) {
          return false;
        }
        const puntoFin = {
          lat: publicacion.puntoFinLat,
          lon: publicacion.puntoFinLon,
        };
        return dto.puntos.some(
          (punto) =>
            this.distanciaHaversineKm(puntoFin, punto) <= RADIO_ASISTENCIA_KM,
        );
      }

      case 'ida_vuelta': {
        if (dto.distanciaKm < DISTANCIA_MINIMA_ASISTENCIA_KM) return false;
        const seAlejoDelInicio = dto.puntos.some(
          (punto) =>
            this.distanciaHaversineKm(puntoInicio, punto) > RADIO_ASISTENCIA_KM,
        );
        if (!seAlejoDelInicio) return false;
        const ultimoPunto = dto.puntos[dto.puntos.length - 1];
        return (
          !!ultimoPunto &&
          this.distanciaHaversineKm(puntoInicio, ultimoPunto) <=
            RADIO_ASISTENCIA_KM
        );
      }

      case 'distancia_minima': {
        const minimo =
          publicacion.distanciaMinimaKm ?? DISTANCIA_MINIMA_ASISTENCIA_KM;
        return dto.distanciaKm >= minimo;
      }

      default:
        // Comportamiento histórico: rodadas creadas antes de este ajuste no
        // tienen tipoFinalizacion definido.
        return dto.distanciaKm >= DISTANCIA_MINIMA_ASISTENCIA_KM;
    }
  }

  async guardarRecorrido(miembroId: number, dto: RecorridoDto) {
    const total = await this.prisma.recorrido.count({ where: { miembroId } });
    if (total >= MAX_RECORRIDOS_GUARDADOS) {
      throw new ConflictException(
        `Has alcanzado el máximo de ${MAX_RECORRIDOS_GUARDADOS} rutas guardadas. Para guardar una nueva ruta, elimina uno de tus recorridos anteriores.`,
      );
    }

    const asistenciaConfirmada = dto.publicacionId
      ? await this.cumpleReglasAsistencia(miembroId, dto.publicacionId, dto)
      : false;

    const recorrido = await this.prisma.recorrido.create({
      data: {
        miembroId,
        tipo: asistenciaConfirmada ? 'ruta' : dto.tipo,
        distanciaKm: dto.distanciaKm,
        duracionSeg: dto.duracionSeg,
        puntos: JSON.stringify(dto.puntos),
      },
    });

    if (asistenciaConfirmada && dto.publicacionId) {
      await this.prisma.asistenciaRodada.upsert({
        where: {
          publicacionId_miembroId: {
            publicacionId: dto.publicacionId,
            miembroId,
          },
        },
        create: {
          publicacionId: dto.publicacionId,
          miembroId,
          recorridoId: recorrido.id,
        },
        update: { recorridoId: recorrido.id },
      });
    }

    // Hitos de "Distancias Alcanzadas" del perfil: se comparan contra la
    // mejor distancia de una sola ruta, guardada aparte para que sobreviva
    // aunque esta ruta se borre después (tope de 10 rutas guardadas).
    await this.prisma.miembro.updateMany({
      where: { id: miembroId, mejorDistanciaRuta: { lt: dto.distanciaKm } },
      data: { mejorDistanciaRuta: dto.distanciaKm },
    });

    return { id: recorrido.id, mensaje: 'Recorrido guardado' };
  }

  async eliminarRecorrido(miembroId: number, id: number) {
    const recorrido = await this.prisma.recorrido.findFirst({
      where: { id, miembroId },
    });
    if (!recorrido) throw new NotFoundException('Recorrido no encontrado');

    await this.prisma.recorrido.delete({ where: { id } });
    return { mensaje: 'Recorrido eliminado' };
  }

  async alternarFavorito(miembroId: number, id: number) {
    const recorrido = await this.prisma.recorrido.findFirst({
      where: { id, miembroId },
    });
    if (!recorrido) throw new NotFoundException('Recorrido no encontrado');

    const actualizado = await this.prisma.recorrido.update({
      where: { id },
      data: { favorito: !recorrido.favorito },
    });
    return { favorito: actualizado.favorito };
  }

  async misRecorridos(miembroId: number) {
    const recorridos = await this.prisma.recorrido.findMany({
      where: { miembroId },
      orderBy: { createdAt: 'desc' },
      take: MAX_RECORRIDOS_GUARDADOS,
      select: {
        id: true,
        tipo: true,
        distanciaKm: true,
        duracionSeg: true,
        createdAt: true,
        puntos: true,
        favorito: true,
      },
    });

    return recorridos.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      distanciaKm: r.distanciaKm,
      duracionSeg: r.duracionSeg,
      createdAt: r.createdAt,
      favorito: r.favorito,
      puntos: this.decimarPuntos(JSON.parse(r.puntos)),
    }));
  }

  // Reduce la cantidad de puntos que viajan al frontend para la vista previa
  // de "Mis rutas" (ajuste post-Fase 11), conservando siempre el primer y
  // último punto para que el inicio/fin del trazado no se pierdan.
  private decimarPuntos<T>(puntos: T[], maximo = 50): T[] {
    if (puntos.length <= maximo) return puntos;
    const paso = (puntos.length - 1) / (maximo - 1);
    const resultado: T[] = [];
    for (let i = 0; i < maximo; i++) {
      resultado.push(puntos[Math.round(i * paso)]);
    }
    return resultado;
  }
}
