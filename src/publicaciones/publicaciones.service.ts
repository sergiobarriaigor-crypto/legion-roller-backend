import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearPublicacionDto } from './dto/crear-publicacion.dto';
import { ActualizarPublicacionDto } from './dto/actualizar-publicacion.dto';

@Injectable()
export class PublicacionesService {
  constructor(private prisma: PrismaService) {}

  private estaVencida(publicacion: { duracionHoras: number | null; createdAt: Date }) {
    if (!publicacion.duracionHoras) return false;
    const expiraEn =
      publicacion.createdAt.getTime() + publicacion.duracionHoras * 60 * 60 * 1000;
    return Date.now() > expiraEn;
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
        ...p,
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
    return Object.fromEntries(respuestas.map((r) => [r.publicacionId, r.estado]));
  }

  crear(dto: CrearPublicacionDto) {
    return this.prisma.publicacion.create({ data: dto });
  }

  async actualizar(id: number, dto: ActualizarPublicacionDto) {
    await this.obtenerOFallar(id);
    return this.prisma.publicacion.update({ where: { id }, data: dto });
  }

  async eliminar(id: number) {
    await this.obtenerOFallar(id);
    await this.prisma.rsvpRespuesta.deleteMany({ where: { publicacionId: id } });
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

  private async obtenerOFallar(id: number) {
    const publicacion = await this.prisma.publicacion.findUnique({ where: { id } });
    if (!publicacion) throw new NotFoundException('Publicación no encontrada');
    return publicacion;
  }
}
