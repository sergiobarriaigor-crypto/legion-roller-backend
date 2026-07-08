import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearPostDto } from './dto/crear-post.dto';
import { ActualizarPostDto } from './dto/actualizar-post.dto';

const DIAS_VIGENCIA_POST = 7;

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async listar(autorId?: number) {
    const limite = new Date(Date.now() - DIAS_VIGENCIA_POST * 24 * 60 * 60 * 1000);

    const posts = await this.prisma.post.findMany({
      where: { createdAt: { gte: limite }, ...(autorId ? { autorId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        autor: { select: { id: true, nombre: true } },
        reacciones: true,
        comentarios: {
          orderBy: { createdAt: 'asc' },
          include: { autor: { select: { id: true, nombre: true } } },
        },
      },
    });

    return posts.map((p) => ({
      id: p.id,
      autorId: p.autorId,
      autorNombre: p.autor.nombre,
      titulo: p.titulo,
      resena: p.resena,
      ubicacion: p.ubicacion,
      fotoUrl: p.fotoUrl,
      createdAt: p.createdAt,
      reaccionesCount: p.reacciones.length,
      comentarios: p.comentarios.map((c) => ({
        id: c.id,
        autorNombre: c.autor.nombre,
        texto: c.texto,
        createdAt: c.createdAt,
      })),
    }));
  }

  async misReacciones(miembroId: number) {
    const reacciones = await this.prisma.reaccionPost.findMany({
      where: { miembroId },
      select: { postId: true },
    });
    return reacciones.map((r) => r.postId);
  }

  crear(autorId: number, dto: CrearPostDto) {
    return this.prisma.post.create({ data: { ...dto, autorId } });
  }

  async actualizar(id: number, autorId: number, dto: ActualizarPostDto) {
    const post = await this.obtenerOFallar(id);
    if (post.autorId !== autorId) {
      throw new ForbiddenException('Solo puedes editar tus propios posts');
    }
    return this.prisma.post.update({ where: { id }, data: dto });
  }

  async eliminar(id: number, miembroId: number, rol: string) {
    const post = await this.obtenerOFallar(id);
    if (post.autorId !== miembroId && rol !== 'admin') {
      throw new ForbiddenException('No puedes eliminar este post');
    }
    await this.prisma.comentarioPost.deleteMany({ where: { postId: id } });
    await this.prisma.reaccionPost.deleteMany({ where: { postId: id } });
    await this.prisma.post.delete({ where: { id } });
    return { mensaje: 'Post eliminado' };
  }

  async toggleReaccion(postId: number, miembroId: number) {
    await this.obtenerOFallar(postId);
    const existente = await this.prisma.reaccionPost.findUnique({
      where: { postId_miembroId: { postId, miembroId } },
    });

    if (existente) {
      await this.prisma.reaccionPost.delete({ where: { id: existente.id } });
    } else {
      await this.prisma.reaccionPost.create({ data: { postId, miembroId } });
    }

    const total = await this.prisma.reaccionPost.count({ where: { postId } });
    return { reaccionesCount: total, miReaccion: !existente };
  }

  async agregarComentario(postId: number, autorId: number, texto: string) {
    await this.obtenerOFallar(postId);
    const comentario = await this.prisma.comentarioPost.create({
      data: { postId, autorId, texto },
      include: { autor: { select: { nombre: true } } },
    });
    return {
      id: comentario.id,
      autorNombre: comentario.autor.nombre,
      texto: comentario.texto,
      createdAt: comentario.createdAt,
    };
  }

  private async obtenerOFallar(id: number) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post no encontrado');
    return post;
  }
}
