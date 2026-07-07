import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UbicacionDto } from './dto/ubicacion.dto';
import { RecorridoDto } from './dto/recorrido.dto';

const HORAS_VIGENCIA_PATINANDO = 4;

@Injectable()
export class MapaService {
  constructor(private prisma: PrismaService) {}

  async activarPatinando(miembroId: number, dto: UbicacionDto) {
    const ubicacion = await this.prisma.ubicacionActiva.upsert({
      where: { miembroId },
      create: { miembroId, lat: dto.lat, lon: dto.lon },
      update: { lat: dto.lat, lon: dto.lon },
    });
    return ubicacion;
  }

  async terminarPatinando(miembroId: number) {
    await this.prisma.ubicacionActiva.deleteMany({ where: { miembroId } });
    return { mensaje: 'Dejaste de compartir tu ubicación' };
  }

  async patinandoAhora() {
    const limite = new Date(Date.now() - HORAS_VIGENCIA_PATINANDO * 60 * 60 * 1000);
    const activos = await this.prisma.ubicacionActiva.findMany({
      where: { actualizadoEn: { gte: limite } },
      include: { miembro: { select: { id: true, nombre: true } } },
    });

    return activos.map((u) => ({
      miembroId: u.miembro.id,
      nombre: u.miembro.nombre,
      lat: u.lat,
      lon: u.lon,
      actualizadoEn: u.actualizadoEn,
    }));
  }

  async guardarRecorrido(miembroId: number, dto: RecorridoDto) {
    const recorrido = await this.prisma.recorrido.create({
      data: {
        miembroId,
        tipo: dto.tipo,
        distanciaKm: dto.distanciaKm,
        duracionSeg: dto.duracionSeg,
        puntos: JSON.stringify(dto.puntos),
      },
    });
    return { id: recorrido.id, mensaje: 'Recorrido guardado' };
  }

  async misRecorridos(miembroId: number) {
    const recorridos = await this.prisma.recorrido.findMany({
      where: { miembroId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tipo: true,
        distanciaKm: true,
        duracionSeg: true,
        createdAt: true,
      },
    });
    return recorridos;
  }
}
