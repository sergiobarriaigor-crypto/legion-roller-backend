import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { FichaEmprendedorDto } from './dto/ficha-emprendedor.dto';

const MAX_DESTINATARIOS_COMPARTIR = 5;

@Injectable()
export class EmprendedoresService {
  constructor(
    private prisma: PrismaService,
    private chat: ChatService,
  ) {}

  private incluir() {
    return {
      miembro: { select: { id: true, nombre: true } },
      reacciones: true,
      _count: { select: { resenas: true } },
      anuncios: { orderBy: { createdAt: 'desc' as const } },
    };
  }

  private formatear(e: {
    id: number;
    miembroId: number;
    miembro: { nombre: string };
    nombreNegocio: string;
    rubro: string;
    descripcion: string;
    contacto: string;
    ubicacion: string | null;
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    fotos: string | null;
    aprobado: boolean;
    solicitadoAt: Date;
    reacciones: { miembroId: number }[];
    _count: { resenas: number };
    anuncios: { id: number; texto: string; createdAt: Date }[];
  }) {
    return {
      id: e.id,
      miembroId: e.miembroId,
      nombreDuenio: e.miembro.nombre,
      nombreNegocio: e.nombreNegocio,
      rubro: e.rubro,
      descripcion: e.descripcion,
      contacto: e.contacto,
      ubicacion: e.ubicacion,
      instagram: e.instagram,
      facebook: e.facebook,
      tiktok: e.tiktok,
      fotos: e.fotos ? (JSON.parse(e.fotos) as string[]) : [],
      aprobado: e.aprobado,
      solicitadoAt: e.solicitadoAt,
      reaccionesCount: e.reacciones.length,
      resenasCount: e._count.resenas,
      anuncios: e.anuncios,
    };
  }

  async directorio() {
    const fichas = await this.prisma.emprendedor.findMany({
      where: { aprobado: true },
      orderBy: { solicitadoAt: 'desc' },
      include: this.incluir(),
    });
    return fichas.map((f) => this.formatear(f));
  }

  async miFicha(miembroId: number) {
    const ficha = await this.prisma.emprendedor.findUnique({
      where: { miembroId },
      include: this.incluir(),
    });
    return ficha ? this.formatear(ficha) : null;
  }

  async guardarFicha(miembroId: number, dto: FichaEmprendedorDto) {
    const { fotos, ...resto } = dto;
    const data = {
      ...resto,
      ...(fotos ? { fotos: JSON.stringify(fotos) } : {}),
    };
    const existente = await this.prisma.emprendedor.findUnique({
      where: { miembroId },
    });

    if (existente) {
      const actualizado = await this.prisma.emprendedor.update({
        where: { miembroId },
        data,
        include: this.incluir(),
      });
      return this.formatear(actualizado);
    }

    const creado = await this.prisma.emprendedor.create({
      data: { ...data, miembroId },
      include: this.incluir(),
    });
    return this.formatear(creado);
  }

  async eliminarMiFicha(miembroId: number) {
    const ficha = await this.prisma.emprendedor.findUnique({
      where: { miembroId },
    });
    if (!ficha) throw new NotFoundException('No tienes una ficha');
    await this.eliminarFichaPorId(ficha.id);
    return { mensaje: 'Ficha eliminada' };
  }

  async solicitudesPendientes() {
    const fichas = await this.prisma.emprendedor.findMany({
      where: { aprobado: false },
      orderBy: { solicitadoAt: 'desc' },
      include: this.incluir(),
    });
    return fichas.map((f) => this.formatear(f));
  }

  async aprobar(id: number) {
    await this.obtenerOFallar(id);
    return this.prisma.emprendedor.update({
      where: { id },
      data: { aprobado: true },
    });
  }

  async rechazar(id: number) {
    await this.obtenerOFallar(id);
    await this.eliminarFichaPorId(id);
    return { mensaje: 'Solicitud rechazada' };
  }

  async eliminarComoAdmin(id: number) {
    await this.obtenerOFallar(id);
    await this.eliminarFichaPorId(id);
    return { mensaje: 'Ficha eliminada' };
  }

  async toggleReaccion(emprendedorId: number, miembroId: number) {
    await this.obtenerOFallar(emprendedorId);
    const existente = await this.prisma.reaccionEmprendedor.findUnique({
      where: { emprendedorId_miembroId: { emprendedorId, miembroId } },
    });

    if (existente) {
      await this.prisma.reaccionEmprendedor.delete({
        where: { id: existente.id },
      });
    } else {
      await this.prisma.reaccionEmprendedor.create({
        data: { emprendedorId, miembroId },
      });
    }

    const total = await this.prisma.reaccionEmprendedor.count({
      where: { emprendedorId },
    });
    return { reaccionesCount: total, miReaccion: !existente };
  }

  async agregarResena(
    emprendedorId: number,
    autorId: number,
    texto: string,
    respuestaAId?: number,
  ) {
    await this.obtenerOFallar(emprendedorId);

    if (respuestaAId !== undefined) {
      const original = await this.prisma.resenaEmprendedor.findUnique({
        where: { id: respuestaAId },
      });
      if (!original || original.emprendedorId !== emprendedorId) {
        throw new NotFoundException('La reseña que respondes no existe');
      }
      if (original.respuestaAId !== null) {
        throw new ConflictException(
          'No puedes responder a una respuesta (el hilo tiene un solo nivel)',
        );
      }
    }

    const resena = await this.prisma.resenaEmprendedor.create({
      data: { emprendedorId, autorId, texto, respuestaAId },
      include: { autor: { select: { id: true, nombre: true, fotoUrl: true } } },
    });
    return {
      id: resena.id,
      miembroId: resena.autor.id,
      nombre: resena.autor.nombre,
      fotoUrl: resena.autor.fotoUrl,
      texto: resena.texto,
      respuestaAId: resena.respuestaAId,
      reaccionesCount: 0,
      miReaccion: false,
      createdAt: resena.createdAt,
    };
  }

  // Visible para cualquiera, como los comentarios de un Post — no es un
  // inbox privado del dueño. `respuestaAId` deja armar el hilo en el cliente.
  async resenasDe(emprendedorId: number, miembroIdActual: number) {
    await this.obtenerOFallar(emprendedorId);

    const resenas = await this.prisma.resenaEmprendedor.findMany({
      where: { emprendedorId },
      orderBy: { createdAt: 'asc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
        reacciones: { select: { miembroId: true } },
      },
    });

    return resenas.map((r) => ({
      id: r.id,
      miembroId: r.autor.id,
      nombre: r.autor.nombre,
      fotoUrl: r.autor.fotoUrl,
      texto: r.texto,
      respuestaAId: r.respuestaAId,
      reaccionesCount: r.reacciones.length,
      miReaccion: r.reacciones.some((x) => x.miembroId === miembroIdActual),
      createdAt: r.createdAt,
    }));
  }

  // Puede eliminarla el propio autor de la reseña, el dueño de la ficha, o un
  // admin. Se borran también sus respuestas directas (el hilo solo tiene un
  // nivel, así que alcanza con eso).
  async eliminarResena(
    emprendedorId: number,
    resenaId: number,
    miembroId: number,
    rol: string,
  ) {
    const ficha = await this.obtenerOFallar(emprendedorId);
    const resena = await this.prisma.resenaEmprendedor.findUnique({
      where: { id: resenaId },
    });
    if (!resena || resena.emprendedorId !== emprendedorId) {
      throw new NotFoundException('Reseña no encontrada');
    }
    const puedeEliminar =
      resena.autorId === miembroId ||
      ficha.miembroId === miembroId ||
      rol === 'admin';
    if (!puedeEliminar) {
      throw new ForbiddenException('No puedes eliminar esta reseña');
    }

    await this.prisma.reaccionResenaEmprendedor.deleteMany({
      where: { resenaId: { in: [resenaId] } },
    });
    const respuestas = await this.prisma.resenaEmprendedor.findMany({
      where: { respuestaAId: resenaId },
      select: { id: true },
    });
    if (respuestas.length > 0) {
      await this.prisma.reaccionResenaEmprendedor.deleteMany({
        where: { resenaId: { in: respuestas.map((r) => r.id) } },
      });
    }
    await this.prisma.resenaEmprendedor.deleteMany({
      where: { respuestaAId: resenaId },
    });
    await this.prisma.resenaEmprendedor.delete({ where: { id: resenaId } });
    return { mensaje: 'Reseña eliminada' };
  }

  // Corazón sobre una reseña puntual — interacción visual simple, sin
  // notificación de campana (a diferencia de nada más, acá no hay reacción
  // "a la ficha entera" que notifique).
  async toggleReaccionResena(resenaId: number, miembroId: number) {
    const resena = await this.prisma.resenaEmprendedor.findUnique({
      where: { id: resenaId },
    });
    if (!resena) throw new NotFoundException('Reseña no encontrada');

    const existente = await this.prisma.reaccionResenaEmprendedor.findUnique({
      where: { resenaId_miembroId: { resenaId, miembroId } },
    });

    if (existente) {
      await this.prisma.reaccionResenaEmprendedor.delete({
        where: { id: existente.id },
      });
    } else {
      await this.prisma.reaccionResenaEmprendedor.create({
        data: { resenaId, miembroId },
      });
    }

    const total = await this.prisma.reaccionResenaEmprendedor.count({
      where: { resenaId },
    });
    return { reaccionesCount: total, miReaccion: !existente };
  }

  // Para la campana del header: reseñas que me incumben y todavía no vi. Dos
  // casos: (a) alguien respondió una de MIS reseñas, o (b) alguien dejó una
  // reseña raíz en MI ficha. No se cuenta una reseña/respuesta a uno mismo.
  async respuestasSinLeer(miembroId: number) {
    const resenas = await this.prisma.resenaEmprendedor.findMany({
      where: {
        leida: false,
        autorId: { not: miembroId },
        OR: [
          { respuestaA: { autorId: miembroId } },
          { respuestaAId: null, emprendedor: { miembroId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
        emprendedor: { select: { id: true } },
      },
    });

    return resenas.map((r) => ({
      id: r.id,
      emprendedorId: r.emprendedor.id,
      autorNombre: r.autor.nombre,
      autorFotoUrl: r.autor.fotoUrl,
      texto: r.texto,
      createdAt: r.createdAt,
      esRespuesta: r.respuestaAId !== null,
    }));
  }

  // Solo quien recibe la notificación puede apagarla: quien le respondieron,
  // o el dueño de la ficha si es una reseña raíz.
  async marcarRespuestaLeida(resenaId: number, miembroId: number) {
    const resena = await this.prisma.resenaEmprendedor.findUnique({
      where: { id: resenaId },
      include: {
        respuestaA: { select: { autorId: true } },
        emprendedor: { select: { miembroId: true } },
      },
    });
    const autorizado =
      resena?.respuestaA?.autorId === miembroId ||
      (resena?.respuestaAId === null &&
        resena?.emprendedor.miembroId === miembroId);
    if (!resena || !autorizado) {
      throw new ForbiddenException('No puedes marcar esta notificación');
    }
    await this.prisma.resenaEmprendedor.update({
      where: { id: resenaId },
      data: { leida: true },
    });
    return { leida: true };
  }

  // Comparte la ficha puertas adentro de la app: un mensaje de chat por
  // destinatario (reusa MensajeChat.referenciaTipo/referenciaId, ya
  // habilitado en MensajeDto) en su sala DM. Tope de 5 por acción (validado
  // también en el DTO), sin duplicados ni auto-envío.
  async compartir(
    emprendedorId: number,
    remitenteId: number,
    destinatarioIds: number[],
  ) {
    await this.obtenerOFallar(emprendedorId);

    if (destinatarioIds.length > MAX_DESTINATARIOS_COMPARTIR) {
      throw new ConflictException(
        `Solo puedes compartir con hasta ${MAX_DESTINATARIOS_COMPARTIR} personas por vez.`,
      );
    }
    if (destinatarioIds.includes(remitenteId)) {
      throw new ConflictException(
        'No puedes compartirte una ficha a ti mismo.',
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
        texto: '📌 Te compartió un emprendimiento',
        referenciaTipo: 'emprendedor',
        referenciaId: emprendedorId,
      });
    }

    return { compartidoCon: idsUnicos.size };
  }

  async agregarAnuncio(
    emprendedorId: number,
    miembroId: number,
    texto: string,
  ) {
    const ficha = await this.obtenerOFallar(emprendedorId);
    if (ficha.miembroId !== miembroId) {
      throw new ForbiddenException(
        'Solo el dueño de la ficha puede agregar anuncios',
      );
    }
    return this.prisma.anuncioEmprendedor.create({
      data: { emprendedorId, texto },
    });
  }

  async eliminarAnuncio(
    emprendedorId: number,
    anuncioId: number,
    miembroId: number,
  ) {
    const ficha = await this.obtenerOFallar(emprendedorId);
    if (ficha.miembroId !== miembroId) {
      throw new ForbiddenException(
        'Solo el dueño de la ficha puede eliminar anuncios',
      );
    }
    await this.prisma.anuncioEmprendedor.delete({ where: { id: anuncioId } });
    return { mensaje: 'Anuncio eliminado' };
  }

  private async eliminarFichaPorId(id: number) {
    const resenas = await this.prisma.resenaEmprendedor.findMany({
      where: { emprendedorId: id },
      select: { id: true },
    });
    if (resenas.length > 0) {
      await this.prisma.reaccionResenaEmprendedor.deleteMany({
        where: { resenaId: { in: resenas.map((r) => r.id) } },
      });
    }
    await this.prisma.anuncioEmprendedor.deleteMany({
      where: { emprendedorId: id },
    });
    await this.prisma.resenaEmprendedor.deleteMany({
      where: { emprendedorId: id },
    });
    await this.prisma.reaccionEmprendedor.deleteMany({
      where: { emprendedorId: id },
    });
    await this.prisma.emprendedor.delete({ where: { id } });
  }

  private async obtenerOFallar(id: number) {
    const ficha = await this.prisma.emprendedor.findUnique({ where: { id } });
    if (!ficha) throw new NotFoundException('Ficha no encontrada');
    return ficha;
  }
}
