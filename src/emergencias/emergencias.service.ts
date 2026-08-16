import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmergenciasGateway } from './emergencias.gateway';

const MOTIVOS_QUE_REQUIEREN_AMBULANCIA = ['caida', 'salud'];

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
    this.emergenciasGateway.emitirActivacion(miembroId);
    return creada;
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
