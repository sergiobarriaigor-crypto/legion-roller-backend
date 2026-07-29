import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UbicacionDto } from './dto/ubicacion.dto';
import { RecorridoDto } from './dto/recorrido.dto';

const HORAS_VIGENCIA_PATINANDO = 4;
const HORAS_ESTADO = 8;
const MAX_RECORRIDOS_GUARDADOS = 10;

// Si el usuario cierra la app sin presionar "Terminar de patinar" (se le
// acaba la batería, pierde señal, mata la app), la fila de UbicacionActiva
// nunca se borra — sigue "activa" hasta que patinandoAhora() la filtra por
// vigencia. Si vuelve a abrir la app después de un vacío real de pings (el
// frontend manda uno cada 20s mientras el modo sigue activo), sin esto el
// upsert de abajo solo actualiza lat/lon/modo y deja iniciadoEn pegado en el
// arranque original — dando una antigüedad falsa ("hace 3 días") para una
// sesión que en los hechos recién está retomando. 3 minutos sin ping es más
// que suficiente para distinguir un corte real de un simple parpadeo de red.
const MINUTOS_VACIO_CUENTA_COMO_NUEVA_SESION = 3;

// Sin esto, tocar "Patinando" y de inmediato "Terminar de patinar" ya cuenta
// como 1 ruta permanente de 0.00 km (los contadores del perfil nunca se
// restan, ver guardarRecorrido más abajo). Mismo criterio que ya existe en
// el frontend para "movimiento significativo" (~30m) — un poco más generoso
// acá porque esto decide si CUENTA la sesión entera, no solo un tramo.
const DISTANCIA_MINIMA_GUARDAR_KM = 0.05;
const DURACION_MINIMA_GUARDAR_SEG = 45;

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
    const existente = await this.prisma.ubicacionActiva.findUnique({
      where: { miembroId },
    });
    const vacioLargo =
      existente &&
      Date.now() - existente.actualizadoEn.getTime() >
        MINUTOS_VACIO_CUENTA_COMO_NUEVA_SESION * 60 * 1000;

    const ubicacion = await this.prisma.ubicacionActiva.upsert({
      where: { miembroId },
      create: { miembroId, lat: dto.lat, lon: dto.lon, modo },
      update: {
        lat: dto.lat,
        lon: dto.lon,
        modo,
        ...(vacioLargo ? { iniciadoEn: new Date() } : {}),
      },
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
    // Toque accidental (activar y cortar casi de inmediato): no se guarda
    // nada -- ni Recorrido, ni suma a los contadores permanentes -- y no se
    // muestra ningún error, simplemente no pasó nada. La asistencia oficial
    // confirmada siempre exige DISTANCIA_MINIMA_ASISTENCIA_KM (3km), muy por
    // encima de este umbral, así que nunca se descarta una asistencia real.
    if (
      dto.distanciaKm < DISTANCIA_MINIMA_GUARDAR_KM &&
      dto.duracionSeg < DURACION_MINIMA_GUARDAR_SEG
    ) {
      return { id: null, guardado: false };
    }

    const asistenciaConfirmada = dto.publicacionId
      ? await this.cumpleReglasAsistencia(miembroId, dto.publicacionId, dto)
      : false;
    const tipoFinal = asistenciaConfirmada ? 'ruta' : dto.tipo;

    // Estadísticas permanentes del perfil (ajuste: ya no se recalculan en
    // vivo sumando Recorrido — ver perfil.service.ts calcularStats). Se
    // incrementan siempre, sin importar el tope de rutas guardadas de más
    // abajo, para que "toda actividad iniciada mediante Patinando" cuente,
    // se guarde o no el detalle del trazado.
    await this.prisma.miembro.update({
      where: { id: miembroId },
      data: {
        kmTotalesAcumulados: { increment: dto.distanciaKm },
        kmOficialesAcumulados:
          tipoFinal === 'ruta' ? { increment: dto.distanciaKm } : undefined,
        duracionSegAcumulada: { increment: dto.duracionSeg },
        numRutasAcumuladas: { increment: 1 },
      },
    });

    // Hitos de "Distancias Alcanzadas" del perfil: se comparan contra la
    // mejor distancia de una sola ruta, guardada aparte para que sobreviva
    // aunque esta ruta se borre después (tope de 10 rutas guardadas).
    await this.prisma.miembro.updateMany({
      where: { id: miembroId, mejorDistanciaRuta: { lt: dto.distanciaKm } },
      data: { mejorDistanciaRuta: dto.distanciaKm },
    });

    // El tope de "Mis rutas" solo aplica a lo mapeado (esa sección existe
    // para guardar el trazado/mapa de rutas mapeadas, con cupo limitado) — una
    // sesión sin mapear nunca compite por ese cupo ni se bloquea por esto,
    // porque de todas formas no guarda trazado y siempre debe quedar
    // registrada completa en el Historial de recorridos del perfil (sin
    // tope). Las estadísticas de arriba ya se guardaron pase lo que pase acá.
    if (dto.mapeado) {
      const totalMapeados = await this.prisma.recorrido.count({
        where: { miembroId, mapeado: true },
      });
      if (totalMapeados >= MAX_RECORRIDOS_GUARDADOS) {
        return {
          id: null,
          guardadoDetalle: false,
          mensaje: `Tus estadísticas se guardaron, pero alcanzaste el máximo de ${MAX_RECORRIDOS_GUARDADOS} rutas mapeadas en Mis Rutas. Quita el mapeo de una para guardar el detalle de esta.`,
        };
      }
    }

    const recorrido = await this.prisma.recorrido.create({
      data: {
        miembroId,
        tipo: tipoFinal,
        mapeado: dto.mapeado,
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

    return {
      id: recorrido.id,
      guardadoDetalle: true,
      mensaje: 'Recorrido guardado',
    };
  }

  // "Eliminar" desde Mis Rutas ya no borra la fila — esa sección existe para
  // guardar rutas mapeadas, así que "eliminar" en realidad le quita la marca
  // de mapeado. Así: desaparece de Mis Rutas (deja de contar para el tope de
  // 10 mapeadas), pero la actividad sigue existiendo en el Historial de
  // recorridos del perfil (con la etiqueta "· SM"), y esto NUNCA toca los
  // contadores permanentes del Miembro (kmTotalesAcumulados/etc.) — quitar el
  // mapeo no debe restar nada de las estadísticas ya acumuladas en
  // guardarRecorrido.
  async eliminarRecorrido(miembroId: number, id: number) {
    const recorrido = await this.prisma.recorrido.findFirst({
      where: { id, miembroId },
    });
    if (!recorrido) throw new NotFoundException('Recorrido no encontrado');

    await this.prisma.recorrido.update({
      where: { id },
      data: { mapeado: false },
    });
    return { mensaje: 'Se quitó el mapeo de este recorrido' };
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

  // "Mis rutas": esta sección existe específicamente para guardar el
  // trazado/mapa de rutas mapeadas (con cupo de MAX_RECORRIDOS_GUARDADOS) —
  // por eso solo trae `mapeado: true`. Las actividades sin mapear (o las que
  // el usuario "eliminó" de acá, que en realidad solo les quita el mapeado —
  // ver eliminarRecorrido) nunca aparecen en esta lista; siguen existiendo en
  // el Historial de recorridos del perfil (ver historialRecorridos).
  async misRecorridos(miembroId: number) {
    const recorridos = await this.prisma.recorrido.findMany({
      where: { miembroId, mapeado: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_RECORRIDOS_GUARDADOS,
      select: {
        id: true,
        tipo: true,
        mapeado: true,
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
      mapeado: r.mapeado,
      distanciaKm: r.distanciaKm,
      duracionSeg: r.duracionSeg,
      createdAt: r.createdAt,
      favorito: r.favorito,
      puntos: this.decimarPuntos(JSON.parse(r.puntos)),
    }));
  }

  // Historial de recorridos del perfil: TODAS las actividades (mapeadas, sin
  // mapear, rodadas oficiales) sin ningún tope — a diferencia de "Mis rutas",
  // acá no importa el cupo de 10 porque esta lista no guarda trazado (el
  // perfil solo muestra fecha/distancia/tiempo/tipo), así que no hace falta
  // pedir `puntos` ni `favorito`.
  async historialRecorridos(miembroId: number) {
    const recorridos = await this.prisma.recorrido.findMany({
      where: { miembroId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tipo: true,
        mapeado: true,
        distanciaKm: true,
        duracionSeg: true,
        createdAt: true,
      },
    });

    return recorridos;
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
