import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MOTIVOS_QUE_REQUIEREN_AMBULANCIA = ['caida', 'salud'];

@Injectable()
export class EmergenciasService {
  constructor(private prisma: PrismaService) {}

  async activar(miembroId: number, motivo: string) {
    const existente = await this.prisma.emergencia.findFirst({
      where: { miembroId, activa: true },
    });
    if (existente) return existente;

    return this.prisma.emergencia.create({
      data: {
        miembroId,
        motivo,
        requiereAmbulancia: MOTIVOS_QUE_REQUIEREN_AMBULANCIA.includes(motivo),
      },
    });
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
    return { mensaje: 'Emergencia cancelada' };
  }

  async miEmergencia(miembroId: number) {
    return this.prisma.emergencia.findFirst({ where: { miembroId, activa: true } });
  }

  async activas() {
    const emergencias = await this.prisma.emergencia.findMany({
      where: { activa: true },
      orderBy: { createdAt: 'desc' },
      include: {
        miembro: {
          select: { id: true, nombre: true, ubicacionActiva: true },
        },
      },
    });

    return emergencias.map((e) => ({
      id: e.id,
      miembroId: e.miembroId,
      nombre: e.miembro.nombre,
      motivo: e.motivo,
      requiereAmbulancia: e.requiereAmbulancia,
      createdAt: e.createdAt,
      lat: e.miembro.ubicacionActiva?.lat ?? null,
      lon: e.miembro.ubicacionActiva?.lon ?? null,
    }));
  }
}
