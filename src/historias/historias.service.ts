import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearHistoriaDto } from './dto/crear-historia.dto';

const HORAS_VIGENCIA_HISTORIA = 24;
const MAX_HISTORIAS_ACTIVAS = 10;

@Injectable()
export class HistoriasService {
  constructor(private prisma: PrismaService) {}

  private limiteVigencia() {
    return new Date(Date.now() - HORAS_VIGENCIA_HISTORIA * 60 * 60 * 1000);
  }

  async crear(autorId: number, dto: CrearHistoriaDto) {
    const total = await this.prisma.historia.count({
      where: { autorId, createdAt: { gte: this.limiteVigencia() } },
    });
    if (total >= MAX_HISTORIAS_ACTIVAS) {
      throw new ConflictException(
        `Ya tienes ${MAX_HISTORIAS_ACTIVAS} historias activas. Espera a que alguna expire (24h) o elimina una para publicar una nueva.`,
      );
    }
    if (dto.mencionadoId) {
      const existe = await this.prisma.miembro.findUnique({ where: { id: dto.mencionadoId } });
      if (!existe) throw new NotFoundException('El miembro mencionado no existe');
    }
    return this.prisma.historia.create({ data: { ...dto, autorId } });
  }

  async listarAgrupadas(miembroIdActual: number) {
    const historias = await this.prisma.historia.findMany({
      where: { createdAt: { gte: this.limiteVigencia() } },
      orderBy: { createdAt: 'asc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
        mencionado: { select: { id: true, nombre: true } },
        reacciones: { select: { miembroId: true, leida: true } },
      },
    });

    if (historias.length === 0) return [];

    const vistas = await this.prisma.vistaHistoria.findMany({
      where: {
        miembroId: miembroIdActual,
        historiaId: { in: historias.map((h) => h.id) },
      },
      select: { historiaId: true },
    });
    const idsVistos = new Set(vistas.map((v) => v.historiaId));

    const grupos = new Map<
      number,
      {
        autorId: number;
        autorNombre: string;
        autorFotoUrl: string | null;
        historias: typeof historias;
      }
    >();
    for (const h of historias) {
      const grupo = grupos.get(h.autorId) ?? {
        autorId: h.autorId,
        autorNombre: h.autor.nombre,
        autorFotoUrl: h.autor.fotoUrl,
        historias: [],
      };
      grupo.historias.push(h);
      grupos.set(h.autorId, grupo);
    }

    return [...grupos.values()]
      .map((g) => ({
        autorId: g.autorId,
        autorNombre: g.autorNombre,
        autorFotoUrl: g.autorFotoUrl,
        vistoCompleto: g.historias.every((h) => idsVistos.has(h.id)),
        // Notificación liviana para el propio autor: hay reacciones sin leer
        // en alguna de sus historias activas (se marcan leídas al consultar
        // /historias/:id/reacciones).
        reaccionesSinLeer:
          g.autorId === miembroIdActual &&
          g.historias.some((h) => h.reacciones.some((r) => !r.leida)),
        historias: g.historias.map((h) => ({
          id: h.id,
          tipo: h.tipo,
          mediaUrl: h.mediaUrl,
          texto: h.texto,
          textoEstilo: h.textoEstilo,
          ubicacion: h.ubicacion,
          mencionadoId: h.mencionado?.id ?? null,
          mencionadoNombre: h.mencionado?.nombre ?? null,
          mencionX: h.mencionX,
          mencionY: h.mencionY,
          reaccionesCount: h.reacciones.length,
          miReaccion: h.reacciones.some((r) => r.miembroId === miembroIdActual),
          createdAt: h.createdAt,
        })),
      }))
      .sort((a, b) => {
        if (a.vistoCompleto !== b.vistoCompleto) return a.vistoCompleto ? 1 : -1;
        const ultimoA = a.historias[a.historias.length - 1].createdAt.getTime();
        const ultimoB = b.historias[b.historias.length - 1].createdAt.getTime();
        return ultimoB - ultimoA;
      });
  }

  async marcarVista(historiaId: number, miembroId: number) {
    await this.obtenerOFallar(historiaId);
    const existente = await this.prisma.vistaHistoria.findUnique({
      where: { historiaId_miembroId: { historiaId, miembroId } },
    });
    if (!existente) {
      await this.prisma.vistaHistoria.create({ data: { historiaId, miembroId } });
    }
    return { vista: true };
  }

  async eliminar(id: number, miembroId: number, rol: string) {
    const historia = await this.obtenerOFallar(id);
    if (historia.autorId !== miembroId && rol !== 'admin') {
      throw new ForbiddenException('No puedes eliminar esta historia');
    }
    await this.prisma.vistaHistoria.deleteMany({ where: { historiaId: id } });
    await this.prisma.reaccionHistoria.deleteMany({ where: { historiaId: id } });
    await this.prisma.historia.delete({ where: { id } });
    return { mensaje: 'Historia eliminada' };
  }

  // El "patín dorado" de Legión Roller — un solo tipo de reacción, mismo
  // patrón toggle que ReaccionPost.
  async toggleReaccion(historiaId: number, miembroId: number) {
    await this.obtenerOFallar(historiaId);
    const existente = await this.prisma.reaccionHistoria.findUnique({
      where: { historiaId_miembroId: { historiaId, miembroId } },
    });

    if (existente) {
      await this.prisma.reaccionHistoria.delete({ where: { id: existente.id } });
    } else {
      await this.prisma.reaccionHistoria.create({ data: { historiaId, miembroId } });
    }

    const total = await this.prisma.reaccionHistoria.count({ where: { historiaId } });
    return { reaccionesCount: total, miReaccion: !existente };
  }

  // Solo el autor puede ver quién reaccionó (misma lógica que Instagram: la
  // lista de "quién reaccionó a tu historia" es privada del autor). Al
  // consultarla se marcan como leídas, apagando la notificación liviana.
  async reaccionesDe(historiaId: number, miembroIdSolicitante: number) {
    const historia = await this.obtenerOFallar(historiaId);
    if (historia.autorId !== miembroIdSolicitante) {
      throw new ForbiddenException('Solo el autor puede ver quién reaccionó');
    }

    const reacciones = await this.prisma.reaccionHistoria.findMany({
      where: { historiaId },
      orderBy: { createdAt: 'desc' },
      include: { miembro: { select: { id: true, nombre: true, fotoUrl: true } } },
    });

    await this.prisma.reaccionHistoria.updateMany({
      where: { historiaId, leida: false },
      data: { leida: true },
    });

    return reacciones.map((r) => ({
      miembroId: r.miembro.id,
      nombre: r.miembro.nombre,
      fotoUrl: r.miembro.fotoUrl,
      createdAt: r.createdAt,
    }));
  }

  private async obtenerOFallar(id: number) {
    const historia = await this.prisma.historia.findUnique({ where: { id } });
    if (!historia) throw new NotFoundException('Historia no encontrada');
    return historia;
  }
}
