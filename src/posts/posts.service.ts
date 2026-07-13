import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { CrearPostDto } from './dto/crear-post.dto';
import { ActualizarPostDto } from './dto/actualizar-post.dto';

const DIAS_VIGENCIA_POST = 7;
const MAX_FOTOS_POR_POST = 3;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MAX_DESTINATARIOS_COMPARTIR = 5;

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private chat: ChatService,
  ) {}

  async listar(autorId?: number) {
    const limite = new Date(Date.now() - DIAS_VIGENCIA_POST * MS_POR_DIA);

    const posts = await this.prisma.post.findMany({
      where: { createdAt: { gte: limite }, ...(autorId ? { autorId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
        reacciones: true,
        _count: { select: { comentarios: true } },
      },
    });

    return posts.map((p) => {
      const venceEn = new Date(
        p.createdAt.getTime() + DIAS_VIGENCIA_POST * MS_POR_DIA,
      );
      const diasRestantes = Math.max(
        0,
        Math.ceil((venceEn.getTime() - Date.now()) / MS_POR_DIA),
      );

      return {
        id: p.id,
        autorId: p.autorId,
        autorNombre: p.autor.nombre,
        autorFotoUrl: p.autor.fotoUrl,
        titulo: p.titulo,
        resena: p.resena,
        ubicacion: p.ubicacion,
        tipo: p.tipo as 'foto' | 'video',
        fotos: p.fotos ? (JSON.parse(p.fotos) as string[]) : [],
        videoUrl: p.videoUrl,
        createdAt: p.createdAt,
        diasRestantes,
        reaccionesCount: p.reacciones.length,
        comentariosCount: p._count.comentarios,
      };
    });
  }

  async misReacciones(miembroId: number) {
    const reacciones = await this.prisma.reaccionPost.findMany({
      where: { miembroId },
      select: { postId: true },
    });
    return reacciones.map((r) => r.postId);
  }

  crear(autorId: number, dto: CrearPostDto) {
    const { fotos, tipo, videoUrl, ...resto } = dto;
    if (fotos && fotos.length > MAX_FOTOS_POR_POST) {
      throw new ConflictException(
        `Cada publicación admite un máximo de ${MAX_FOTOS_POR_POST} fotografías.`,
      );
    }
    return this.prisma.post.create({
      data: {
        ...resto,
        autorId,
        tipo: tipo ?? 'foto',
        fotos:
          tipo === 'video'
            ? undefined
            : fotos && fotos.length > 0
              ? JSON.stringify(fotos)
              : undefined,
        videoUrl: tipo === 'video' ? videoUrl : undefined,
      },
    });
  }

  async actualizar(id: number, autorId: number, dto: ActualizarPostDto) {
    const post = await this.obtenerOFallar(id);
    if (post.autorId !== autorId) {
      throw new ForbiddenException('Solo puedes editar tus propios posts');
    }
    const { fotos, tipo, videoUrl, ...resto } = dto;
    if (fotos && fotos.length > MAX_FOTOS_POR_POST) {
      throw new ConflictException(
        `Cada publicación admite un máximo de ${MAX_FOTOS_POR_POST} fotografías.`,
      );
    }
    return this.prisma.post.update({
      where: { id },
      data: {
        ...resto,
        ...(tipo ? { tipo } : {}),
        ...(fotos ? { fotos: JSON.stringify(fotos) } : {}),
        ...(videoUrl ? { videoUrl } : {}),
      },
    });
  }

  async eliminar(id: number, miembroId: number, rol: string) {
    const post = await this.obtenerOFallar(id);
    if (post.autorId !== miembroId && rol !== 'admin') {
      throw new ForbiddenException('No puedes eliminar este post');
    }
    const comentarios = await this.prisma.comentarioPost.findMany({
      where: { postId: id },
      select: { id: true },
    });
    await this.prisma.reaccionComentarioPost.deleteMany({
      where: { comentarioId: { in: comentarios.map((c) => c.id) } },
    });
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

  async agregarComentario(
    postId: number,
    autorId: number,
    texto: string,
    respuestaAId?: number,
  ) {
    await this.obtenerOFallar(postId);

    if (respuestaAId !== undefined) {
      const original = await this.prisma.comentarioPost.findUnique({
        where: { id: respuestaAId },
      });
      if (!original || original.postId !== postId) {
        throw new NotFoundException('El comentario que respondes no existe');
      }
      if (original.respuestaAId !== null) {
        throw new ConflictException(
          'No puedes responder a una respuesta (el hilo tiene un solo nivel)',
        );
      }
    }

    const comentario = await this.prisma.comentarioPost.create({
      data: { postId, autorId, texto, respuestaAId },
      include: { autor: { select: { id: true, nombre: true, fotoUrl: true } } },
    });
    return {
      id: comentario.id,
      miembroId: comentario.autor.id,
      nombre: comentario.autor.nombre,
      fotoUrl: comentario.autor.fotoUrl,
      texto: comentario.texto,
      respuestaAId: comentario.respuestaAId,
      reaccionesCount: 0,
      miReaccion: false,
      createdAt: comentario.createdAt,
    };
  }

  // Visible para cualquiera, como los comentarios de una Historia — no es un
  // inbox privado del autor. `respuestaAId` deja armar el hilo en el cliente.
  async comentariosDe(postId: number, miembroIdActual: number) {
    await this.obtenerOFallar(postId);

    const comentarios = await this.prisma.comentarioPost.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
        reacciones: { select: { miembroId: true } },
      },
    });

    return comentarios.map((c) => ({
      id: c.id,
      miembroId: c.autor.id,
      nombre: c.autor.nombre,
      fotoUrl: c.autor.fotoUrl,
      texto: c.texto,
      respuestaAId: c.respuestaAId,
      reaccionesCount: c.reacciones.length,
      miReaccion: c.reacciones.some((r) => r.miembroId === miembroIdActual),
      createdAt: c.createdAt,
    }));
  }

  // Puede eliminarlo el propio autor del comentario, el dueño del post, o un
  // admin. Se borran también sus respuestas directas (el hilo solo tiene un
  // nivel, así que alcanza con eso).
  async eliminarComentario(
    postId: number,
    comentarioId: number,
    miembroId: number,
    rol: string,
  ) {
    const post = await this.obtenerOFallar(postId);
    const comentario = await this.prisma.comentarioPost.findUnique({
      where: { id: comentarioId },
    });
    if (!comentario || comentario.postId !== postId) {
      throw new NotFoundException('Comentario no encontrado');
    }
    const puedeEliminar =
      comentario.autorId === miembroId ||
      post.autorId === miembroId ||
      rol === 'admin';
    if (!puedeEliminar) {
      throw new ForbiddenException('No puedes eliminar este comentario');
    }

    await this.prisma.reaccionComentarioPost.deleteMany({
      where: { comentarioId: { in: [comentarioId] } },
    });
    const respuestas = await this.prisma.comentarioPost.findMany({
      where: { respuestaAId: comentarioId },
      select: { id: true },
    });
    if (respuestas.length > 0) {
      await this.prisma.reaccionComentarioPost.deleteMany({
        where: { comentarioId: { in: respuestas.map((r) => r.id) } },
      });
    }
    await this.prisma.comentarioPost.deleteMany({
      where: { respuestaAId: comentarioId },
    });
    await this.prisma.comentarioPost.delete({ where: { id: comentarioId } });
    return { mensaje: 'Comentario eliminado' };
  }

  // Corazón sobre un comentario puntual — interacción visual simple, sin
  // notificación de campana (a diferencia de la reacción al post).
  async toggleReaccionComentario(comentarioId: number, miembroId: number) {
    const comentario = await this.prisma.comentarioPost.findUnique({
      where: { id: comentarioId },
    });
    if (!comentario) throw new NotFoundException('Comentario no encontrado');

    const existente = await this.prisma.reaccionComentarioPost.findUnique({
      where: { comentarioId_miembroId: { comentarioId, miembroId } },
    });

    if (existente) {
      await this.prisma.reaccionComentarioPost.delete({
        where: { id: existente.id },
      });
    } else {
      await this.prisma.reaccionComentarioPost.create({
        data: { comentarioId, miembroId },
      });
    }

    const total = await this.prisma.reaccionComentarioPost.count({
      where: { comentarioId },
    });
    return { reaccionesCount: total, miReaccion: !existente };
  }

  // Visible para cualquiera (como "a quién le gustó" en Historias). Solo
  // cuando la consulta el propio autor se marcan como leídas (apaga la
  // notificación agrupada) — si la mira otra persona, no altera ese estado.
  async reaccionesDe(postId: number, miembroIdSolicitante: number) {
    const post = await this.obtenerOFallar(postId);

    const reacciones = await this.prisma.reaccionPost.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' },
      include: {
        miembro: { select: { id: true, nombre: true, fotoUrl: true } },
      },
    });

    if (post.autorId === miembroIdSolicitante) {
      await this.prisma.reaccionPost.updateMany({
        where: { postId, leida: false },
        data: { leida: true },
      });
    }

    return reacciones.map((r) => ({
      miembroId: r.miembro.id,
      nombre: r.miembro.nombre,
      fotoUrl: r.miembro.fotoUrl,
      createdAt: r.createdAt,
    }));
  }

  // Para la campana del header: comentarios que me incumben y todavía no vi.
  // Dos casos: (a) alguien respondió uno de MIS comentarios, o (b) alguien
  // dejó un comentario raíz en MI post. Solo cuenta posts que siguen
  // vigentes. No se cuenta un comentario/respuesta a uno mismo.
  async respuestasSinLeer(miembroId: number) {
    const limite = new Date(Date.now() - DIAS_VIGENCIA_POST * MS_POR_DIA);
    const comentarios = await this.prisma.comentarioPost.findMany({
      where: {
        leida: false,
        autorId: { not: miembroId },
        post: { createdAt: { gte: limite } },
        OR: [
          { respuestaA: { autorId: miembroId } },
          { respuestaAId: null, post: { autorId: miembroId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
      },
    });

    return comentarios.map((c) => ({
      id: c.id,
      postId: c.postId,
      autorNombre: c.autor.nombre,
      autorFotoUrl: c.autor.fotoUrl,
      texto: c.texto,
      createdAt: c.createdAt,
      esRespuesta: c.respuestaAId !== null,
    }));
  }

  // Para la campana: reacciones (corazón) sin leer en MIS posts, agrupadas
  // por post — si 20 personas reaccionan al mismo post no queremos 20 filas,
  // sino una sola con los primeros dos nombres (con foto) y "y otras N".
  async reaccionesSinLeerAgrupadas(miembroId: number) {
    const limite = new Date(Date.now() - DIAS_VIGENCIA_POST * MS_POR_DIA);
    const reacciones = await this.prisma.reaccionPost.findMany({
      where: {
        leida: false,
        miembroId: { not: miembroId },
        post: { autorId: miembroId, createdAt: { gte: limite } },
      },
      orderBy: { createdAt: 'desc' },
      include: { miembro: { select: { nombre: true, fotoUrl: true } } },
    });

    const porPost = new Map<number, typeof reacciones>();
    for (const r of reacciones) {
      const lista = porPost.get(r.postId) ?? [];
      lista.push(r);
      porPost.set(r.postId, lista);
    }

    return [...porPost.entries()]
      .map(([postId, lista]) => ({
        postId,
        total: lista.length,
        primeros: lista.slice(0, 2).map((r) => ({
          nombre: r.miembro.nombre,
          fotoUrl: r.miembro.fotoUrl,
        })),
        createdAt: lista[0].createdAt,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Solo quien recibe la notificación puede apagarla: quien le respondieron,
  // o el autor del post si es un comentario raíz.
  async marcarRespuestaLeida(comentarioId: number, miembroId: number) {
    const comentario = await this.prisma.comentarioPost.findUnique({
      where: { id: comentarioId },
      include: {
        respuestaA: { select: { autorId: true } },
        post: { select: { autorId: true } },
      },
    });
    const autorizado =
      comentario?.respuestaA?.autorId === miembroId ||
      (comentario?.respuestaAId === null &&
        comentario?.post.autorId === miembroId);
    if (!comentario || !autorizado) {
      throw new ForbiddenException('No puedes marcar esta notificación');
    }
    await this.prisma.comentarioPost.update({
      where: { id: comentarioId },
      data: { leida: true },
    });
    return { leida: true };
  }

  // Comparte el post puertas adentro de la app: un mensaje de chat por
  // destinatario (reusa MensajeChat.referenciaTipo/referenciaId, ya
  // habilitado en MensajeDto) en su sala DM. Tope de 5 por acción (validado
  // también en el DTO), sin duplicados ni auto-envío.
  async compartir(
    postId: number,
    remitenteId: number,
    destinatarioIds: number[],
  ) {
    await this.obtenerOFallar(postId);

    if (destinatarioIds.length > MAX_DESTINATARIOS_COMPARTIR) {
      throw new ConflictException(
        `Solo puedes compartir con hasta ${MAX_DESTINATARIOS_COMPARTIR} personas por vez.`,
      );
    }
    if (destinatarioIds.includes(remitenteId)) {
      throw new ConflictException(
        'No puedes compartirte una publicación a ti mismo.',
      );
    }
    const idsUnicos = new Set(destinatarioIds);
    if (idsUnicos.size !== destinatarioIds.length) {
      throw new ConflictException(
        'No puedes elegir a la misma persona más de una vez.',
      );
    }
    const existentes = await this.prisma.miembro.count({
      where: { id: { in: [...idsUnicos] } },
    });
    if (existentes !== idsUnicos.size) {
      throw new NotFoundException('Alguno de los destinatarios no existe');
    }

    for (const destinatarioId of idsUnicos) {
      const sala = this.chat.salaIndividual(remitenteId, destinatarioId);
      await this.chat.enviarMensaje(sala, remitenteId, {
        texto: '📌 Te compartió una publicación',
        referenciaTipo: 'post',
        referenciaId: postId,
      });
    }

    return { compartidoCon: idsUnicos.size };
  }

  private async obtenerOFallar(id: number) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post no encontrado');
    return post;
  }
}
