import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const HORAS_ESTADO = 8;
const DIAS_VIGENCIA_RECO = 30;
const MAX_FOTOS_GALERIA = 6;

// Catálogo de claves válidas — debe reflejar CATALOGO_TECNICAS del frontend
// (frontend/src/lib/perfil.ts), que además guarda categoría + etiqueta de
// cada una. Acá solo se valida la clave, no hace falta duplicar las categorías.
const TECNICAS_VALIDAS = [
  'cuna',
  't',
  'soul',
  'power_slide',
  'magic_slide',
  'parallel_slide',
  'contra',
  'salto_frente',
  '180',
  'fakie_180',
  '360',
  'fakie_plano',
  'downhill_fakie',
];

@Injectable()
export class PerfilService {
  constructor(private prisma: PrismaService) {}

  private async calcularStats(miembroId: number) {
    const recorridos = await this.prisma.recorrido.findMany({
      where: { miembroId },
    });
    const kmTotales = recorridos.reduce((s, r) => s + r.distanciaKm, 0);
    const kmOficiales = recorridos
      .filter((r) => r.tipo === 'ruta')
      .reduce((s, r) => s + r.distanciaKm, 0);
    const horasPatinadas =
      recorridos.reduce((s, r) => s + r.duracionSeg, 0) / 3600;

    // "asistencias" y "eventos" ya no cuentan el RSVP en sí (eso solo es
    // intención de ir), sino la asistencia confirmada: por GPS/ruta para
    // rodadas (AsistenciaRodada, ver mapa.service.ts) y por las reglas de
    // publicaciones.service.ts confirmarAsistenciaEvento para eventos
    // (AsistenciaEvento).
    const asistencias = await this.prisma.asistenciaRodada.count({
      where: { miembroId },
    });
    const eventos = await this.prisma.asistenciaEvento.count({
      where: { miembroId },
    });

    return {
      kmOficiales: Math.round(kmOficiales * 100) / 100,
      kmTotales: Math.round(kmTotales * 100) / 100,
      numRutas: recorridos.length,
      asistencias,
      eventos,
      horasPatinadas: Math.round(horasPatinadas * 10) / 10,
    };
  }

  private estadoVigente(miembro: {
    estadoTexto: string | null;
    estadoSetAt: Date | null;
  }) {
    if (!miembro.estadoTexto || !miembro.estadoSetAt) return null;
    const expiraEn =
      miembro.estadoSetAt.getTime() + HORAS_ESTADO * 60 * 60 * 1000;
    if (Date.now() > expiraEn) return null;
    return { texto: miembro.estadoTexto, setAt: miembro.estadoSetAt };
  }

  async perfilPublico(miembroId: number) {
    const miembro = await this.obtenerOFallar(miembroId);
    const stats = await this.calcularStats(miembroId);
    const tecnicas = await this.prisma.miembroTecnica.findMany({
      where: { miembroId },
      select: { tecnica: true },
    });

    return {
      id: miembro.id,
      nombre: miembro.nombre,
      ciudad: miembro.ciudad,
      rol: miembro.rol,
      fotoUrl: miembro.fotoUrl,
      stats,
      mejorDistanciaRuta: miembro.mejorDistanciaRuta,
      tecnicas: tecnicas.map((t) => t.tecnica),
      estado: this.estadoVigente(miembro),
    };
  }

  async miPerfil(miembroId: number) {
    const publico = await this.perfilPublico(miembroId);
    const limite = new Date(
      Date.now() - DIAS_VIGENCIA_RECO * 24 * 60 * 60 * 1000,
    );

    const reconocimientos = await this.prisma.reconocimientoRecibido.findMany({
      where: { paraId: miembroId, createdAt: { gte: limite } },
      orderBy: { createdAt: 'desc' },
      include: { de: { select: { nombre: true, fotoUrl: true } } },
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
        deFotoUrl: r.de.fotoUrl,
        texto: r.texto,
        createdAt: r.createdAt,
        leida: r.leida,
      })),
    };
  }

  async toggleTecnica(miembroId: number, tecnica: string) {
    if (!TECNICAS_VALIDAS.includes(tecnica)) {
      throw new BadRequestException('Técnica no válida');
    }
    await this.obtenerOFallar(miembroId);

    const existente = await this.prisma.miembroTecnica.findUnique({
      where: { miembroId_tecnica: { miembroId, tecnica } },
    });

    if (existente) {
      await this.prisma.miembroTecnica.delete({ where: { id: existente.id } });
    } else {
      await this.prisma.miembroTecnica.create({ data: { miembroId, tecnica } });
    }

    return { tecnica, activo: !existente };
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

  async setFoto(miembroId: number, fotoUrl: string) {
    await this.prisma.miembro.update({
      where: { id: miembroId },
      data: { fotoUrl },
    });
    return { fotoUrl };
  }

  async quitarFoto(miembroId: number) {
    await this.prisma.miembro.update({
      where: { id: miembroId },
      data: { fotoUrl: null },
    });
    return { mensaje: 'Foto de perfil eliminada' };
  }

  async enviarReconocimiento(deId: number, paraId: number, texto: string) {
    if (deId === paraId) {
      throw new BadRequestException(
        'No puedes enviarte un reconocimiento a ti mismo',
      );
    }
    await this.obtenerOFallar(paraId);
    const reconocimiento = await this.prisma.reconocimientoRecibido.create({
      data: { deId, paraId, texto },
    });
    return { id: reconocimiento.id, mensaje: 'Reconocimiento enviado' };
  }

  // Visible para cualquiera (como un mini-feed de posts dentro del perfil).
  async galeriaDe(miembroId: number, miembroIdSolicitante: number) {
    await this.obtenerOFallar(miembroId);
    const fotos = await this.prisma.fotoGaleria.findMany({
      where: { miembroId },
      orderBy: { createdAt: 'desc' },
      include: { reacciones: { select: { miembroId: true } } },
    });

    return fotos.map((f) => ({
      id: f.id,
      url: f.url,
      createdAt: f.createdAt,
      reaccionesCount: f.reacciones.length,
      miReaccion: f.reacciones.some(
        (r) => r.miembroId === miembroIdSolicitante,
      ),
    }));
  }

  async agregarFotoGaleria(miembroId: number, url: string) {
    const total = await this.prisma.fotoGaleria.count({ where: { miembroId } });
    if (total >= MAX_FOTOS_GALERIA) {
      throw new ConflictException(
        `Tu galería admite un máximo de ${MAX_FOTOS_GALERIA} fotografías.`,
      );
    }
    const foto = await this.prisma.fotoGaleria.create({
      data: { miembroId, url },
    });
    return {
      id: foto.id,
      url: foto.url,
      createdAt: foto.createdAt,
      reaccionesCount: 0,
      miReaccion: false,
    };
  }

  async eliminarFotoGaleria(fotoId: number, miembroId: number, rol: string) {
    const foto = await this.prisma.fotoGaleria.findUnique({
      where: { id: fotoId },
    });
    if (!foto) throw new NotFoundException('Foto no encontrada');
    if (foto.miembroId !== miembroId && rol !== 'admin') {
      throw new ForbiddenException('No puedes eliminar esta foto');
    }
    await this.prisma.reaccionFotoGaleria.deleteMany({ where: { fotoId } });
    await this.prisma.fotoGaleria.delete({ where: { id: fotoId } });
    return { mensaje: 'Foto eliminada' };
  }

  async toggleReaccionFoto(fotoId: number, miembroId: number) {
    const foto = await this.prisma.fotoGaleria.findUnique({
      where: { id: fotoId },
    });
    if (!foto) throw new NotFoundException('Foto no encontrada');

    const existente = await this.prisma.reaccionFotoGaleria.findUnique({
      where: { fotoId_miembroId: { fotoId, miembroId } },
    });

    if (existente) {
      await this.prisma.reaccionFotoGaleria.delete({
        where: { id: existente.id },
      });
    } else {
      await this.prisma.reaccionFotoGaleria.create({
        data: { fotoId, miembroId },
      });
    }

    const total = await this.prisma.reaccionFotoGaleria.count({
      where: { fotoId },
    });
    return { reaccionesCount: total, miReaccion: !existente };
  }

  private async obtenerOFallar(id: number) {
    const miembro = await this.prisma.miembro.findUnique({ where: { id } });
    if (!miembro) throw new NotFoundException('Miembro no encontrado');
    return miembro;
  }
}
