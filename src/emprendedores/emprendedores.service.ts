import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FichaEmprendedorDto } from './dto/ficha-emprendedor.dto';

@Injectable()
export class EmprendedoresService {
  constructor(private prisma: PrismaService) {}

  private incluir() {
    return {
      miembro: { select: { id: true, nombre: true } },
      reacciones: true,
      resenas: {
        orderBy: { createdAt: 'desc' as const },
        include: { autor: { select: { nombre: true } } },
      },
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
    aprobado: boolean;
    solicitadoAt: Date;
    reacciones: { miembroId: number }[];
    resenas: { id: number; texto: string; createdAt: Date; autor: { nombre: string } }[];
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
      aprobado: e.aprobado,
      solicitadoAt: e.solicitadoAt,
      reaccionesCount: e.reacciones.length,
      resenas: e.resenas.map((r) => ({
        id: r.id,
        autorNombre: r.autor.nombre,
        texto: r.texto,
        createdAt: r.createdAt,
      })),
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
    const existente = await this.prisma.emprendedor.findUnique({ where: { miembroId } });

    if (existente) {
      const actualizado = await this.prisma.emprendedor.update({
        where: { miembroId },
        data: dto,
        include: this.incluir(),
      });
      return this.formatear(actualizado);
    }

    const creado = await this.prisma.emprendedor.create({
      data: { ...dto, miembroId },
      include: this.incluir(),
    });
    return this.formatear(creado);
  }

  async eliminarMiFicha(miembroId: number) {
    const ficha = await this.prisma.emprendedor.findUnique({ where: { miembroId } });
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
    return this.prisma.emprendedor.update({ where: { id }, data: { aprobado: true } });
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
      await this.prisma.reaccionEmprendedor.delete({ where: { id: existente.id } });
    } else {
      await this.prisma.reaccionEmprendedor.create({ data: { emprendedorId, miembroId } });
    }

    const total = await this.prisma.reaccionEmprendedor.count({ where: { emprendedorId } });
    return { reaccionesCount: total, miReaccion: !existente };
  }

  async agregarResena(emprendedorId: number, autorId: number, texto: string) {
    await this.obtenerOFallar(emprendedorId);
    const resena = await this.prisma.resenaEmprendedor.create({
      data: { emprendedorId, autorId, texto },
      include: { autor: { select: { nombre: true } } },
    });
    return {
      id: resena.id,
      autorNombre: resena.autor.nombre,
      texto: resena.texto,
      createdAt: resena.createdAt,
    };
  }

  async agregarAnuncio(emprendedorId: number, miembroId: number, texto: string) {
    const ficha = await this.obtenerOFallar(emprendedorId);
    if (ficha.miembroId !== miembroId) {
      throw new ForbiddenException('Solo el dueño de la ficha puede agregar anuncios');
    }
    return this.prisma.anuncioEmprendedor.create({ data: { emprendedorId, texto } });
  }

  async eliminarAnuncio(emprendedorId: number, anuncioId: number, miembroId: number) {
    const ficha = await this.obtenerOFallar(emprendedorId);
    if (ficha.miembroId !== miembroId) {
      throw new ForbiddenException('Solo el dueño de la ficha puede eliminar anuncios');
    }
    await this.prisma.anuncioEmprendedor.delete({ where: { id: anuncioId } });
    return { mensaje: 'Anuncio eliminado' };
  }

  private async eliminarFichaPorId(id: number) {
    await this.prisma.anuncioEmprendedor.deleteMany({ where: { emprendedorId: id } });
    await this.prisma.resenaEmprendedor.deleteMany({ where: { emprendedorId: id } });
    await this.prisma.reaccionEmprendedor.deleteMany({ where: { emprendedorId: id } });
    await this.prisma.emprendedor.delete({ where: { id } });
  }

  private async obtenerOFallar(id: number) {
    const ficha = await this.prisma.emprendedor.findUnique({ where: { id } });
    if (!ficha) throw new NotFoundException('Ficha no encontrada');
    return ficha;
  }
}
