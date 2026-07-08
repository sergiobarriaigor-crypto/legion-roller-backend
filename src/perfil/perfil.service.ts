import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const HORAS_ESTADO = 8;
const DIAS_VIGENCIA_RECO = 15;
const TECNICAS_VALIDAS = ['t', 'soul', 'maggi', 'parallel'] as const;
type Tecnica = (typeof TECNICAS_VALIDAS)[number];

const CAMPO_TECNICA: Record<Tecnica, string> = {
  t: 'tecnicaT',
  soul: 'tecnicaSoul',
  maggi: 'tecnicaMaggi',
  parallel: 'tecnicaParallel',
};

@Injectable()
export class PerfilService {
  constructor(private prisma: PrismaService) {}

  private async calcularStats(miembroId: number) {
    const recorridos = await this.prisma.recorrido.findMany({ where: { miembroId } });
    const kmTotales = recorridos.reduce((s, r) => s + r.distanciaKm, 0);
    const kmOficiales = recorridos
      .filter((r) => r.tipo === 'ruta')
      .reduce((s, r) => s + r.distanciaKm, 0);
    const horasPatinadas = recorridos.reduce((s, r) => s + r.duracionSeg, 0) / 3600;

    const rsvpsConfirmados = await this.prisma.rsvpRespuesta.findMany({
      where: { miembroId, estado: 'yes' },
      include: { publicacion: { select: { tipo: true } } },
    });
    const asistencias = rsvpsConfirmados.filter((r) => r.publicacion.tipo === 'rodada').length;
    const eventos = rsvpsConfirmados.filter((r) => r.publicacion.tipo === 'evento').length;

    return {
      kmOficiales: Math.round(kmOficiales * 100) / 100,
      kmTotales: Math.round(kmTotales * 100) / 100,
      numRutas: recorridos.length,
      asistencias,
      eventos,
      horasPatinadas: Math.round(horasPatinadas * 10) / 10,
    };
  }

  private estadoVigente(miembro: { estadoTexto: string | null; estadoSetAt: Date | null }) {
    if (!miembro.estadoTexto || !miembro.estadoSetAt) return null;
    const expiraEn = miembro.estadoSetAt.getTime() + HORAS_ESTADO * 60 * 60 * 1000;
    if (Date.now() > expiraEn) return null;
    return { texto: miembro.estadoTexto, setAt: miembro.estadoSetAt };
  }

  async perfilPublico(miembroId: number) {
    const miembro = await this.obtenerOFallar(miembroId);
    const stats = await this.calcularStats(miembroId);

    return {
      id: miembro.id,
      nombre: miembro.nombre,
      ciudad: miembro.ciudad,
      rol: miembro.rol,
      stats,
      tecnicas: {
        t: miembro.tecnicaT,
        soul: miembro.tecnicaSoul,
        maggi: miembro.tecnicaMaggi,
        parallel: miembro.tecnicaParallel,
      },
      estado: this.estadoVigente(miembro),
    };
  }

  async miPerfil(miembroId: number) {
    const publico = await this.perfilPublico(miembroId);
    const limite = new Date(Date.now() - DIAS_VIGENCIA_RECO * 24 * 60 * 60 * 1000);

    const reconocimientos = await this.prisma.reconocimientoRecibido.findMany({
      where: { paraId: miembroId, createdAt: { gte: limite } },
      orderBy: { createdAt: 'desc' },
      include: { de: { select: { nombre: true } } },
    });

    await this.prisma.reconocimientoRecibido.updateMany({
      where: { paraId: miembroId, leida: false },
      data: { leida: true },
    });

    return {
      ...publico,
      reconocimientos: reconocimientos.map((r) => ({
        id: r.id,
        deNombre: r.de.nombre,
        texto: r.texto,
        createdAt: r.createdAt,
        leida: r.leida,
      })),
    };
  }

  async toggleTecnica(miembroId: number, tecnica: string) {
    if (!TECNICAS_VALIDAS.includes(tecnica as Tecnica)) {
      throw new BadRequestException('Técnica no válida');
    }
    const miembro = await this.obtenerOFallar(miembroId);
    const campo = CAMPO_TECNICA[tecnica as Tecnica];
    const valorActual = (miembro as unknown as Record<string, boolean>)[campo];

    await this.prisma.miembro.update({
      where: { id: miembroId },
      data: { [campo]: !valorActual },
    });

    return { tecnica, activo: !valorActual };
  }

  async setEstado(miembroId: number, texto: string) {
    await this.prisma.miembro.update({
      where: { id: miembroId },
      data: { estadoTexto: texto, estadoSetAt: new Date() },
    });
    return { texto, setAt: new Date() };
  }

  async limpiarEstado(miembroId: number) {
    await this.prisma.miembro.update({
      where: { id: miembroId },
      data: { estadoTexto: null, estadoSetAt: null },
    });
    return { mensaje: 'Estado eliminado' };
  }

  async enviarReconocimiento(deId: number, paraId: number, texto: string) {
    if (deId === paraId) {
      throw new BadRequestException('No puedes enviarte un reconocimiento a ti mismo');
    }
    await this.obtenerOFallar(paraId);
    const reconocimiento = await this.prisma.reconocimientoRecibido.create({
      data: { deId, paraId, texto },
    });
    return { id: reconocimiento.id, mensaje: 'Reconocimiento enviado' };
  }

  private async obtenerOFallar(id: number) {
    const miembro = await this.prisma.miembro.findUnique({ where: { id } });
    if (!miembro) throw new NotFoundException('Miembro no encontrado');
    return miembro;
  }
}
