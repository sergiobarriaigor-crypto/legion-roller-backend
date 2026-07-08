import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MensajeDto } from './dto/mensaje.dto';

const SALA_GRUPAL = 'grupal';
const DIAS_VIGENCIA_CHAT = 7;
const PATRON_SALA_INDIVIDUAL = /^dm-(\d+)-(\d+)$/;

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  salaIndividual(id1: number, id2: number): string {
    const [a, b] = [id1, id2].sort((x, y) => x - y);
    return `dm-${a}-${b}`;
  }

  private parseSalaIndividual(sala: string): [number, number] | null {
    const match = PATRON_SALA_INDIVIDUAL.exec(sala);
    if (!match) return null;
    return [Number(match[1]), Number(match[2])];
  }

  private verificarAcceso(sala: string, miembroId: number) {
    if (sala === SALA_GRUPAL) return;
    const par = this.parseSalaIndividual(sala);
    if (!par || !par.includes(miembroId)) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }
  }

  private limiteVigencia() {
    return new Date(Date.now() - DIAS_VIGENCIA_CHAT * 24 * 60 * 60 * 1000);
  }

  async conversaciones(miembroId: number) {
    const limite = this.limiteVigencia();

    const grupal = await this.resumenSala(SALA_GRUPAL, miembroId, limite);

    const salasIndividuales = await this.prisma.mensajeChat.findMany({
      where: { sala: { startsWith: 'dm-' }, createdAt: { gte: limite } },
      distinct: ['sala'],
      select: { sala: true },
    });

    const individuales: Array<
      Awaited<ReturnType<ChatService['resumenSala']>> & { otroMiembroId: number; otroNombre: string }
    > = [];
    for (const { sala } of salasIndividuales) {
      const par = this.parseSalaIndividual(sala);
      if (!par || !par.includes(miembroId)) continue;
      const otroId = par[0] === miembroId ? par[1] : par[0];
      const otro = await this.prisma.miembro.findUnique({
        where: { id: otroId },
        select: { nombre: true },
      });
      const resumen = await this.resumenSala(sala, miembroId, limite);
      individuales.push({ ...resumen, otroMiembroId: otroId, otroNombre: otro?.nombre ?? '?' });
    }

    return { grupal, individuales };
  }

  private async resumenSala(sala: string, miembroId: number, limite: Date) {
    const ultimoMensaje = await this.prisma.mensajeChat.findFirst({
      where: { sala, createdAt: { gte: limite } },
      orderBy: { createdAt: 'desc' },
      include: { autor: { select: { nombre: true } } },
    });

    const lectura = await this.prisma.lecturaChat.findUnique({
      where: { miembroId_sala: { miembroId, sala } },
    });
    const leidoHasta = lectura?.leidoHasta ?? new Date(0);

    const noLeidos = await this.prisma.mensajeChat.count({
      where: {
        sala,
        createdAt: { gte: limite, gt: leidoHasta },
        autorId: { not: miembroId },
      },
    });

    return {
      sala,
      ultimoMensaje: ultimoMensaje
        ? {
            autorNombre: ultimoMensaje.autor.nombre,
            texto: ultimoMensaje.texto,
            createdAt: ultimoMensaje.createdAt,
          }
        : null,
      noLeidos,
    };
  }

  async mensajes(sala: string, miembroId: number) {
    this.verificarAcceso(sala, miembroId);
    const limite = this.limiteVigencia();

    const mensajes = await this.prisma.mensajeChat.findMany({
      where: { sala, createdAt: { gte: limite } },
      orderBy: { createdAt: 'asc' },
      include: { autor: { select: { id: true, nombre: true } } },
    });

    await this.prisma.lecturaChat.upsert({
      where: { miembroId_sala: { miembroId, sala } },
      create: { miembroId, sala, leidoHasta: new Date() },
      update: { leidoHasta: new Date() },
    });

    return mensajes.map((m) => ({
      id: m.id,
      autorId: m.autor.id,
      autorNombre: m.autor.nombre,
      texto: m.texto,
      referenciaTipo: m.referenciaTipo,
      referenciaId: m.referenciaId,
      createdAt: m.createdAt,
    }));
  }

  async enviarMensaje(sala: string, autorId: number, dto: MensajeDto) {
    this.verificarAcceso(sala, autorId);
    const mensaje = await this.prisma.mensajeChat.create({
      data: {
        sala,
        autorId,
        texto: dto.texto,
        referenciaTipo: dto.referenciaTipo,
        referenciaId: dto.referenciaId,
      },
      include: { autor: { select: { id: true, nombre: true } } },
    });

    await this.prisma.lecturaChat.upsert({
      where: { miembroId_sala: { miembroId: autorId, sala } },
      create: { miembroId: autorId, sala, leidoHasta: mensaje.createdAt },
      update: { leidoHasta: mensaje.createdAt },
    });

    return {
      id: mensaje.id,
      autorId: mensaje.autor.id,
      autorNombre: mensaje.autor.nombre,
      texto: mensaje.texto,
      referenciaTipo: mensaje.referenciaTipo,
      referenciaId: mensaje.referenciaId,
      createdAt: mensaje.createdAt,
    };
  }

  async miembros() {
    return this.prisma.miembro.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
  }
}
