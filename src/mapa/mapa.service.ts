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
    const limite = new Date(Date.now() - HORAS_VIGENCIA_PATINANDO * 60 * 60 * 1000);
    const activos = await this.prisma.ubicacionActiva.findMany({
      where: { actualizadoEn: { gte: limite } },
      include: {
        miembro: {
          select: { id: true, nombre: true, fotoUrl: true, estadoTexto: true, estadoSetAt: true },
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

  private estadoVigente(miembro: { estadoTexto: string | null; estadoSetAt: Date | null }) {
    if (!miembro.estadoTexto || !miembro.estadoSetAt) return null;
    const expiraEn = miembro.estadoSetAt.getTime() + HORAS_ESTADO * 60 * 60 * 1000;
    if (Date.now() > expiraEn) return null;
    return miembro.estadoTexto;
  }

  async guardarRecorrido(miembroId: number, dto: RecorridoDto) {
    const total = await this.prisma.recorrido.count({ where: { miembroId } });
    if (total >= MAX_RECORRIDOS_GUARDADOS) {
      throw new ConflictException(
        `Has alcanzado el máximo de ${MAX_RECORRIDOS_GUARDADOS} rutas guardadas. Para guardar una nueva ruta, elimina uno de tus recorridos anteriores.`,
      );
    }

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
