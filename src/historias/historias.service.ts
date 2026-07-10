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
    return this.prisma.historia.create({ data: { ...dto, autorId } });
  }

  async listarAgrupadas(miembroIdActual: number) {
    const historias = await this.prisma.historia.findMany({
      where: { createdAt: { gte: this.limiteVigencia() } },
      orderBy: { createdAt: 'asc' },
      include: { autor: { select: { id: true, nombre: true, fotoUrl: true } } },
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
        historias: g.historias.map((h) => ({
          id: h.id,
          tipo: h.tipo,
          mediaUrl: h.mediaUrl,
          texto: h.texto,
          ubicacion: h.ubicacion,
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
    await this.prisma.historia.delete({ where: { id } });
    return { mensaje: 'Historia eliminada' };
  }

  private async obtenerOFallar(id: number) {
    const historia = await this.prisma.historia.findUnique({ where: { id } });
    if (!historia) throw new NotFoundException('Historia no encontrada');
    return historia;
  }
}
