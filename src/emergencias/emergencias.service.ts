import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmergenciasGateway } from './emergencias.gateway';

const MOTIVOS_QUE_REQUIEREN_AMBULANCIA = ['caida', 'salud'];

// Diseño acordado: el aviso instantáneo (push por socket) de un SOS solo le
// llega a quien está patinando/en ruta cerca -- son los únicos que pueden
// llegar a ayudar de inmediato; alguien lejos o sin estar patinando (en el
// trabajo, estudiando, etc.) no puede hacer nada con un aviso urgente. La
// urgencia médica real ya la cubre el botón de llamada a emergencia de la
// propia app, así que este push es solo apoyo del club, no la red de
// seguridad principal -- por eso no hace falta un aviso de respaldo a
// administradores si nadie califica. El resto de los miembros igual termina
// viendo el SOS en el mapa vía el polling de respaldo (ver
// EmergenciaContext.tsx), solo que sin el empujón instantáneo.
const RADIO_AVISO_SOS_KM = 20;
// Mismo criterio que HORAS_VIGENCIA_PATINANDO en mapa.service.ts -- duplicado
// acá porque este proyecto no comparte código entre módulos del backend (ver
// comentario de distanciaHaversineKm más abajo).
const HORAS_VIGENCIA_PATINANDO = 4;

@Injectable()
export class EmergenciasService {
  constructor(
    private prisma: PrismaService,
    private emergenciasGateway: EmergenciasGateway,
  ) {}

  async activar(miembroId: number, motivo: string, lat?: number, lon?: number) {
    const existente = await this.prisma.emergencia.findFirst({
      where: { miembroId, activa: true },
    });
    if (existente) return existente;

    const creada = await this.prisma.emergencia.create({
      data: {
        miembroId,
        motivo,
        requiereAmbulancia: MOTIVOS_QUE_REQUIEREN_AMBULANCIA.includes(motivo),
        lat,
        lon,
      },
    });
    const destinatarios = await this.obtenerDestinatariosAviso(
      miembroId,
      lat,
      lon,
    );
    this.emergenciasGateway.emitirActivacion(miembroId, destinatarios);
    return creada;
  }

  // Quiénes están patinando/en ruta ahora mismo (mismo criterio de vigencia
  // que mapa.service.ts/patinandoAhora) dentro de RADIO_AVISO_SOS_KM del
  // punto donde se activó el SOS. Si no se pudo capturar la ubicación propia
  // al activar (GPS denegado/falló), no hay con qué filtrar por cercanía --
  // se avisa igual a todos los que están patinando ahora, mejor eso que
  // dejarlos sin aviso instantáneo por un dato que faltó.
  private async obtenerDestinatariosAviso(
    miembroId: number,
    lat?: number,
    lon?: number,
  ): Promise<number[]> {
    const limite = new Date(
      Date.now() - HORAS_VIGENCIA_PATINANDO * 60 * 60 * 1000,
    );
    const patinando = await this.prisma.ubicacionActiva.findMany({
      where: { miembroId: { not: miembroId }, actualizadoEn: { gte: limite } },
      select: { miembroId: true, lat: true, lon: true },
    });

    if (lat == null || lon == null) {
      return patinando.map((p) => p.miembroId);
    }
    return patinando
      .filter(
        (p) => this.distanciaHaversineKm({ lat, lon }, p) <= RADIO_AVISO_SOS_KM,
      )
      .map((p) => p.miembroId);
  }

  // Fórmula de Haversine (mismo criterio que mapa.service.ts, duplicada acá
  // porque este proyecto no comparte código entre módulos del backend).
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

  async cancelar(miembroId: number) {
    const existente = await this.prisma.emergencia.findFirst({
      where: { miembroId, activa: true },
    });
    if (!existente) {
      return { mensaje: 'No tenías una emergencia activa' };
    }
    await this.prisma.emergencia.update({
      where: { id: existente.id },
      data: { activa: false, resueltaAt: new Date() },
    });
    this.emergenciasGateway.emitirCancelacion(miembroId);
    return { mensaje: 'Emergencia cancelada' };
  }

  async miEmergencia(miembroId: number) {
    return this.prisma.emergencia.findFirst({
      where: { miembroId, activa: true },
    });
  }

  async activas() {
    const emergencias = await this.prisma.emergencia.findMany({
      where: { activa: true },
      orderBy: { createdAt: 'desc' },
      include: {
        miembro: {
          select: {
            id: true,
            nombre: true,
            fotoUrl: true,
            ubicacionActiva: true,
          },
        },
      },
    });

    return emergencias.map((e) => ({
      id: e.id,
      miembroId: e.miembroId,
      nombre: e.miembro.nombre,
      fotoUrl: e.miembro.fotoUrl,
      motivo: e.motivo,
      requiereAmbulancia: e.requiereAmbulancia,
      createdAt: e.createdAt,
      // Preferí la ubicación tomada al activar el SOS (ver comentario en el
      // modelo Emergencia) -- solo cae a UbicacionActiva si el GPS falló en
      // ese momento (ej. permiso denegado).
      lat: e.lat ?? e.miembro.ubicacionActiva?.lat ?? null,
      lon: e.lon ?? e.miembro.ubicacionActiva?.lon ?? null,
    }));
  }
}
