import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { MensajeDto } from './dto/mensaje.dto';
import { ChatGateway } from './chat.gateway';
import { ChatPresenceService } from './chat-presence.service';

const SALA_GRUPAL = 'grupal';
// Ajuste: vigencia diferenciada — el grupal se purga más seguido (mucho más
// volumen) que un DM, que conserva el criterio original.
const DIAS_VIGENCIA_GRUPAL = 15;
const DIAS_VIGENCIA_CHAT = 30;
const PATRON_SALA_INDIVIDUAL = /^dm-(\d+)-(\d+)$/;
const MAX_REENVIO_DESTINATARIOS = 5;
const MAX_FIJADOS_GRUPAL = 5;
const MAX_FIJADOS_DM = 1;

// Duplicada localmente (no importada de mapa.service.ts) — mismo criterio ya
// establecido en el proyecto de no compartir helpers pequeños entre módulos.
const HORAS_VIGENCIA_PATINANDO = 4;

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private gateway: ChatGateway,
    private presencia: ChatPresenceService,
  ) {}

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

  private limiteVigencia(esGrupal: boolean) {
    const dias = esGrupal ? DIAS_VIGENCIA_GRUPAL : DIAS_VIGENCIA_CHAT;
    return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  }

  async conversaciones(miembroId: number) {
    const limiteGrupal = this.limiteVigencia(true);
    const limiteDm = this.limiteVigencia(false);

    const grupal = await this.resumenSala(SALA_GRUPAL, miembroId, limiteGrupal);

    const salasIndividuales = await this.prisma.mensajeChat.findMany({
      where: { sala: { startsWith: 'dm-' }, createdAt: { gte: limiteDm } },
      distinct: ['sala'],
      select: { sala: true },
    });

    const individuales: Array<
      Awaited<ReturnType<ChatService['resumenSala']>> & {
        otroMiembroId: number;
        otroNombre: string;
        otroFotoUrl: string | null;
        otroEnLinea: boolean;
      }
    > = [];
    for (const { sala } of salasIndividuales) {
      const par = this.parseSalaIndividual(sala);
      if (!par || !par.includes(miembroId)) continue;
      const otroId = par[0] === miembroId ? par[1] : par[0];
      const otro = await this.prisma.miembro.findUnique({
        where: { id: otroId },
        select: { nombre: true, fotoUrl: true },
      });
      const resumen = await this.resumenSala(sala, miembroId, limiteDm);
      individuales.push({
        ...resumen,
        otroMiembroId: otroId,
        otroNombre: otro?.nombre ?? '?',
        otroFotoUrl: otro?.fotoUrl ?? null,
        otroEnLinea: this.presencia.estaConectado(otroId),
      });
    }

    // Orden por actividad más reciente (el mensaje más nuevo primero) — la
    // consulta de origen no garantiza ningún orden en particular.
    individuales.sort((a, b) => {
      const ta = a.ultimoMensaje?.createdAt.getTime() ?? 0;
      const tb = b.ultimoMensaje?.createdAt.getTime() ?? 0;
      return tb - ta;
    });

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
    const limite = this.limiteVigencia(sala === SALA_GRUPAL);

    const [mensajes, totalMiembros] = await Promise.all([
      this.prisma.mensajeChat.findMany({
        where: {
          sala,
          createdAt: { gte: limite },
          ocultamientos: { none: { miembroId } },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          autor: { select: { id: true, nombre: true, fotoUrl: true } },
          respuestaA: { include: { autor: { select: { nombre: true } } } },
          reacciones: { select: { miembroId: true, emoji: true } },
          encuesta: {
            include: {
              opciones: {
                include: {
                  votos: {
                    select: {
                      miembro: {
                        select: { id: true, nombre: true, fotoUrl: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.miembro.count(),
    ]);

    const lecturaPrevia = await this.prisma.lecturaChat.findUnique({
      where: { miembroId_sala: { miembroId, sala } },
    });
    const ultimoCreatedAt = mensajes.at(-1)?.createdAt;
    const huboAvance =
      !!ultimoCreatedAt &&
      (!lecturaPrevia || ultimoCreatedAt > lecturaPrevia.leidoHasta);

    const ahora = new Date();
    await this.prisma.lecturaChat.upsert({
      where: { miembroId_sala: { miembroId, sala } },
      create: { miembroId, sala, leidoHasta: ahora },
      update: { leidoHasta: ahora },
    });
    if (huboAvance) {
      this.gateway.emitir(sala, 'chat:leido', {
        sala,
        miembroId,
        hasta: ahora.toISOString(),
      });
    }

    return mensajes.map((m) =>
      this.serializarMensaje(m, miembroId, totalMiembros),
    );
  }

  // Álbum: no es un dato nuevo a guardar, solo una vista filtrada de los
  // adjuntos ya enviados en la sala, agrupados por tipo — mismo criterio de
  // acceso/vigencia/ocultamiento que mensajes().
  async adjuntosDeSala(
    sala: string,
    miembroId: number,
    tipo: 'foto' | 'video' | 'archivo',
  ) {
    this.verificarAcceso(sala, miembroId);
    const limite = this.limiteVigencia(sala === SALA_GRUPAL);

    const mensajes = await this.prisma.mensajeChat.findMany({
      where: {
        sala,
        adjuntoTipo: tipo,
        createdAt: { gte: limite },
        ocultamientos: { none: { miembroId } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        adjuntoUrl: true,
        adjuntoArchivoNombre: true,
        adjuntoArchivoTamanoKb: true,
        createdAt: true,
        autor: { select: { nombre: true } },
      },
    });

    return mensajes.map((m) => ({
      id: m.id,
      url: m.adjuntoUrl,
      nombre: m.adjuntoArchivoNombre,
      tamanoKb: m.adjuntoArchivoTamanoKb,
      createdAt: m.createdAt,
      autorNombre: m.autor.nombre,
    }));
  }

  private serializarMensaje(
    m: {
      id: number;
      sala: string;
      autor: { id: number; nombre: string; fotoUrl: string | null };
      texto: string;
      referenciaTipo: string | null;
      referenciaId: number | null;
      createdAt: Date;
      respuestaAId: number | null;
      respuestaA: { texto: string; autor: { nombre: string } } | null;
      reenviadoDeId: number | null;
      adjuntoTipo: string | null;
      adjuntoUrl: string | null;
      adjuntoUbicacionNombre: string | null;
      adjuntoUbicacionLat: number | null;
      adjuntoUbicacionLon: number | null;
      adjuntoRutaDistanciaKm: number | null;
      adjuntoRutaDuracionSeg: number | null;
      adjuntoRutaPuntos: string | null;
      adjuntoArchivoNombre: string | null;
      adjuntoArchivoTamanoKb: number | null;
      adjuntoAudioDuracionSeg: number | null;
      fijado: boolean;
      reacciones: { miembroId: number; emoji: string }[];
      encuesta: {
        id: number;
        anonima: boolean;
        opciones: {
          id: number;
          texto: string;
          votos: {
            miembro: { id: number; nombre: string; fotoUrl: string | null };
          }[];
        }[];
      } | null;
    },
    miembroId: number,
    totalMiembros: number,
  ) {
    return {
      id: m.id,
      sala: m.sala,
      autorId: m.autor.id,
      autorNombre: m.autor.nombre,
      autorFotoUrl: m.autor.fotoUrl,
      texto: m.texto,
      referenciaTipo: m.referenciaTipo,
      referenciaId: m.referenciaId,
      createdAt: m.createdAt,
      respuestaAId: m.respuestaAId,
      respuestaA: m.respuestaA
        ? { texto: m.respuestaA.texto, autorNombre: m.respuestaA.autor.nombre }
        : null,
      reenviado: m.reenviadoDeId !== null,
      adjuntoTipo: m.adjuntoTipo,
      adjuntoUrl: m.adjuntoUrl,
      adjuntoUbicacionNombre: m.adjuntoUbicacionNombre,
      adjuntoUbicacionLat: m.adjuntoUbicacionLat,
      adjuntoUbicacionLon: m.adjuntoUbicacionLon,
      adjuntoRutaDistanciaKm: m.adjuntoRutaDistanciaKm,
      adjuntoRutaDuracionSeg: m.adjuntoRutaDuracionSeg,
      adjuntoRutaPuntos: m.adjuntoRutaPuntos,
      adjuntoArchivoNombre: m.adjuntoArchivoNombre,
      adjuntoArchivoTamanoKb: m.adjuntoArchivoTamanoKb,
      adjuntoAudioDuracionSeg: m.adjuntoAudioDuracionSeg,
      fijado: m.fijado,
      reacciones: m.reacciones,
      encuesta: m.encuesta
        ? {
            id: m.encuesta.id,
            anonima: m.encuesta.anonima,
            opciones: m.encuesta.opciones.map((o) => ({
              id: o.id,
              texto: o.texto,
              votos: o.votos.length,
              votantes: m.encuesta!.anonima
                ? []
                : o.votos.map((v) => v.miembro),
            })),
            totalVotos: m.encuesta.opciones.reduce(
              (acc, o) => acc + o.votos.length,
              0,
            ),
            totalMiembros,
            miVotoOpcionId:
              m.encuesta.opciones.find((o) =>
                o.votos.some((v) => v.miembro.id === miembroId),
              )?.id ?? null,
          }
        : null,
    };
  }

  // marcar-leido explícito, sin re-listar los mensajes — para cuando el motor
  // de chat en vivo ya tiene los mensajes vía socket y solo necesita bajar el
  // cursor de lectura.
  async marcarLeido(sala: string, miembroId: number) {
    this.verificarAcceso(sala, miembroId);
    const ahora = new Date();
    await this.prisma.lecturaChat.upsert({
      where: { miembroId_sala: { miembroId, sala } },
      create: { miembroId, sala, leidoHasta: ahora },
      update: { leidoHasta: ahora },
    });
    this.gateway.emitir(sala, 'chat:leido', {
      sala,
      miembroId,
      hasta: ahora.toISOString(),
    });
    return { ok: true };
  }

  async enviarMensaje(
    sala: string,
    autorId: number,
    dto: MensajeDto,
    reenviadoDeId?: number,
  ) {
    this.verificarAcceso(sala, autorId);

    const texto = dto.texto?.trim() ?? '';
    if (!texto && !dto.adjuntoTipo) {
      throw new BadRequestException('El mensaje necesita texto o un adjunto');
    }

    let respuestaAId: number | null = null;
    if (dto.respuestaAId) {
      const objetivo = await this.prisma.mensajeChat.findUnique({
        where: { id: dto.respuestaAId },
      });
      // Hilo de un solo nivel (mismo criterio que ComentarioPost/ComentarioHistoria):
      // se ignora en silencio si el objetivo no es de esta sala o ya es a su vez una respuesta.
      if (objetivo && objetivo.sala === sala && !objetivo.respuestaAId) {
        respuestaAId = objetivo.id;
      }
    }

    const [mensaje, totalMiembros] = await Promise.all([
      this.prisma.mensajeChat.create({
        data: {
          sala,
          autorId,
          texto,
          referenciaTipo: dto.referenciaTipo,
          referenciaId: dto.referenciaId,
          respuestaAId,
          reenviadoDeId: reenviadoDeId ?? null,
          adjuntoTipo: dto.adjuntoTipo,
          adjuntoUrl: dto.adjuntoUrl,
          adjuntoUbicacionNombre: dto.adjuntoUbicacionNombre,
          adjuntoUbicacionLat: dto.adjuntoUbicacionLat,
          adjuntoUbicacionLon: dto.adjuntoUbicacionLon,
          adjuntoRutaDistanciaKm: dto.adjuntoRutaDistanciaKm,
          adjuntoRutaDuracionSeg: dto.adjuntoRutaDuracionSeg,
          adjuntoRutaPuntos: dto.adjuntoRutaPuntos,
          adjuntoArchivoNombre: dto.adjuntoArchivoNombre,
          adjuntoArchivoTamanoKb: dto.adjuntoArchivoTamanoKb,
          adjuntoAudioDuracionSeg: dto.adjuntoAudioDuracionSeg,
        },
        include: {
          autor: { select: { id: true, nombre: true, fotoUrl: true } },
          respuestaA: { include: { autor: { select: { nombre: true } } } },
          reacciones: { select: { miembroId: true, emoji: true } },
          encuesta: {
            include: {
              opciones: {
                include: {
                  votos: {
                    select: {
                      miembro: {
                        select: { id: true, nombre: true, fotoUrl: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.miembro.count(),
    ]);

    await this.prisma.lecturaChat.upsert({
      where: { miembroId_sala: { miembroId: autorId, sala } },
      create: { miembroId: autorId, sala, leidoHasta: mensaje.createdAt },
      update: { leidoHasta: mensaje.createdAt },
    });

    const resultado = this.serializarMensaje(mensaje, autorId, totalMiembros);
    this.gateway.emitir(sala, 'chat:mensaje', resultado);

    // Si el destinatario ya está conectado en este preciso momento, se marca
    // "entregado" de inmediato en vez de esperar a que abra/entre a la sala.
    const par = this.parseSalaIndividual(sala);
    if (par) {
      const otroId = par[0] === autorId ? par[1] : par[0];
      if (this.presencia.estaConectado(otroId)) {
        await this.prisma.lecturaChat.upsert({
          where: { miembroId_sala: { miembroId: otroId, sala } },
          create: {
            miembroId: otroId,
            sala,
            leidoHasta: new Date(0),
            entregadoHasta: mensaje.createdAt,
          },
          update: { entregadoHasta: mensaje.createdAt },
        });
        this.gateway.emitir(sala, 'chat:entregado', {
          sala,
          miembroId: otroId,
          hasta: mensaje.createdAt.toISOString(),
        });
      }
    }

    return resultado;
  }

  async reaccionar(mensajeId: number, miembroId: number, emoji: string) {
    const mensaje = await this.prisma.mensajeChat.findUnique({
      where: { id: mensajeId },
    });
    if (!mensaje) throw new NotFoundException('Mensaje no encontrado');
    this.verificarAcceso(mensaje.sala, miembroId);

    const existente = await this.prisma.reaccionMensajeChat.findUnique({
      where: { mensajeId_miembroId: { mensajeId, miembroId } },
    });

    let emojiFinal: string | null;
    if (existente && existente.emoji === emoji) {
      await this.prisma.reaccionMensajeChat.delete({
        where: { id: existente.id },
      });
      emojiFinal = null;
    } else {
      await this.prisma.reaccionMensajeChat.upsert({
        where: { mensajeId_miembroId: { mensajeId, miembroId } },
        create: { mensajeId, miembroId, emoji },
        update: { emoji },
      });
      emojiFinal = emoji;
    }

    this.gateway.emitir(mensaje.sala, 'chat:reaccion', {
      mensajeId,
      sala: mensaje.sala,
      miembroId,
      emoji: emojiFinal,
    });
    return { emoji: emojiFinal };
  }

  // Convierte la URL pública (http://host/uploads/archivo.jpg) devuelta por
  // UploadsController a la ruta real en disco, usando el mismo directorio
  // ('uploads' bajo process.cwd()) que uploads.controller.ts y main.ts
  // (useStaticAssets) ya usan para guardar/servir esos archivos.
  private rutaArchivoAdjunto(adjuntoUrl: string): string | null {
    const prefijo = '/uploads/';
    let pathname: string;
    try {
      pathname = new URL(adjuntoUrl).pathname;
    } catch {
      return null;
    }
    if (!pathname.startsWith(prefijo)) return null;
    const nombreArchivo = pathname.slice(prefijo.length);
    if (!nombreArchivo || nombreArchivo.includes('/')) return null;
    return join(process.cwd(), 'uploads', nombreArchivo);
  }

  // Un mensaje reenviado copia adjuntoUrl a su propia fila (reenviarMensaje),
  // así que 2 mensajes distintos pueden apuntar al mismo archivo físico. Solo
  // se borra el archivo cuando, tras el borrado en BD, ya ningún mensaje vivo
  // (original ni reenviado) lo sigue referenciando.
  private async borrarArchivoSiNoSeUsa(
    adjuntoUrl: string | null,
  ): Promise<void> {
    if (!adjuntoUrl) return;
    const enUso = await this.prisma.mensajeChat.count({
      where: { adjuntoUrl },
    });
    if (enUso > 0) return;
    const ruta = this.rutaArchivoAdjunto(adjuntoUrl);
    if (!ruta) return;
    await fs.unlink(ruta).catch(() => {});
  }

  async eliminarMensaje(
    mensajeId: number,
    miembroId: number,
    modo: 'todos' | 'mi',
    esAdmin: boolean,
  ) {
    const mensaje = await this.prisma.mensajeChat.findUnique({
      where: { id: mensajeId },
    });
    if (!mensaje) throw new NotFoundException('Mensaje no encontrado');
    this.verificarAcceso(mensaje.sala, miembroId);

    if (modo === 'mi') {
      await this.prisma.mensajeChatOculto.upsert({
        where: { mensajeId_miembroId: { mensajeId, miembroId } },
        create: { mensajeId, miembroId },
        update: {},
      });
      return { ok: true };
    }

    if (mensaje.autorId !== miembroId && !esAdmin) {
      throw new ForbiddenException(
        'Solo el autor puede eliminar el mensaje para todos',
      );
    }

    // Una respuesta/reenvío que apuntaba a este mensaje sobrevive, solo pierde
    // la cita (no se borra en cascada — es contenido real de la conversación).
    await this.prisma.mensajeChat.updateMany({
      where: { respuestaAId: mensajeId },
      data: { respuestaAId: null },
    });
    await this.prisma.mensajeChat.updateMany({
      where: { reenviadoDeId: mensajeId },
      data: { reenviadoDeId: null },
    });
    await this.prisma.reaccionMensajeChat.deleteMany({
      where: { mensajeId },
    });
    await this.prisma.mensajeChatOculto.deleteMany({ where: { mensajeId } });
    const encuesta = await this.prisma.encuestaChat.findUnique({
      where: { mensajeId },
    });
    if (encuesta) {
      await this.prisma.votoEncuestaChat.deleteMany({
        where: { encuestaId: encuesta.id },
      });
      await this.prisma.opcionEncuestaChat.deleteMany({
        where: { encuestaId: encuesta.id },
      });
      await this.prisma.encuestaChat.delete({ where: { id: encuesta.id } });
    }
    await this.prisma.mensajeChat.delete({ where: { id: mensajeId } });
    await this.borrarArchivoSiNoSeUsa(mensaje.adjuntoUrl);

    this.gateway.emitir(mensaje.sala, 'chat:mensaje-eliminado', {
      mensajeId,
      sala: mensaje.sala,
    });
    return { ok: true };
  }

  // Fijar/desfijar (toggle). En el grupal, hasta MAX_FIJADOS_GRUPAL, solo el
  // admin global; en un DM, hasta MAX_FIJADOS_DM (1), cualquiera de los 2
  // participantes (ya garantizado por verificarAcceso). Desfijar no tiene
  // tope que validar, así que se resuelve antes de revisar el cupo.
  async fijarMensaje(mensajeId: number, miembroId: number, esAdmin: boolean) {
    const mensaje = await this.prisma.mensajeChat.findUnique({
      where: { id: mensajeId },
    });
    if (!mensaje) throw new NotFoundException('Mensaje no encontrado');
    this.verificarAcceso(mensaje.sala, miembroId);

    const esGrupal = mensaje.sala === SALA_GRUPAL;
    if (esGrupal && !esAdmin) {
      throw new ForbiddenException(
        'Solo el admin puede fijar mensajes en el chat grupal',
      );
    }

    if (mensaje.fijado) {
      await this.prisma.mensajeChat.update({
        where: { id: mensajeId },
        data: { fijado: false, fijadoEn: null },
      });
      this.gateway.emitir(mensaje.sala, 'chat:fijado', {
        mensajeId,
        sala: mensaje.sala,
        fijado: false,
      });
      return { fijado: false };
    }

    const max = esGrupal ? MAX_FIJADOS_GRUPAL : MAX_FIJADOS_DM;
    const cantidadActual = await this.prisma.mensajeChat.count({
      where: { sala: mensaje.sala, fijado: true },
    });
    if (cantidadActual >= max) {
      throw new BadRequestException(
        esGrupal
          ? `Ya hay ${MAX_FIJADOS_GRUPAL} mensajes fijados. Desfija uno para poder fijar este.`
          : 'Ya hay un mensaje fijado en esta conversación. Desfíjalo para poder fijar este.',
      );
    }

    await this.prisma.mensajeChat.update({
      where: { id: mensajeId },
      data: { fijado: true, fijadoEn: new Date() },
    });
    this.gateway.emitir(mensaje.sala, 'chat:fijado', {
      mensajeId,
      sala: mensaje.sala,
      fijado: true,
    });
    return { fijado: true };
  }

  async mensajesFijados(sala: string, miembroId: number) {
    this.verificarAcceso(sala, miembroId);
    const mensajes = await this.prisma.mensajeChat.findMany({
      where: { sala, fijado: true },
      orderBy: { fijadoEn: 'desc' },
      include: { autor: { select: { nombre: true, fotoUrl: true } } },
    });
    return mensajes.map((m) => ({
      id: m.id,
      texto: m.texto,
      autorNombre: m.autor.nombre,
      autorFotoUrl: m.autor.fotoUrl,
      createdAt: m.createdAt,
      adjuntoTipo: m.adjuntoTipo,
    }));
  }

  // Encuesta: solo en el chat grupal, cualquiera puede crearla. Se guarda
  // como un MensajeChat normal (adjuntoTipo:"encuesta", pregunta = texto) con
  // un EncuestaChat colgado — eliminarla es eliminarMensaje(modo:"todos")
  // sobre ese mensaje, mismo permiso (autor o admin) que ya existe ahí.
  async crearEncuesta(
    sala: string,
    autorId: number,
    pregunta: string,
    opciones: string[],
    anonima: boolean,
  ) {
    this.verificarAcceso(sala, autorId);
    if (sala !== SALA_GRUPAL) {
      throw new ForbiddenException(
        'Las encuestas solo están disponibles en el chat grupal',
      );
    }

    const preguntaLimpia = pregunta.trim();
    const opcionesLimpias = opciones
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (!preguntaLimpia) {
      throw new BadRequestException('La encuesta necesita una pregunta');
    }
    if (opcionesLimpias.length < 2 || opcionesLimpias.length > 10) {
      throw new BadRequestException('Elige entre 2 y 10 opciones');
    }

    const [mensaje, totalMiembros] = await Promise.all([
      this.prisma.mensajeChat.create({
        data: {
          sala,
          autorId,
          texto: preguntaLimpia,
          adjuntoTipo: 'encuesta',
          encuesta: {
            create: {
              anonima,
              opciones: { create: opcionesLimpias.map((texto) => ({ texto })) },
            },
          },
        },
        include: {
          autor: { select: { id: true, nombre: true, fotoUrl: true } },
          respuestaA: { include: { autor: { select: { nombre: true } } } },
          reacciones: { select: { miembroId: true, emoji: true } },
          encuesta: {
            include: {
              opciones: {
                include: {
                  votos: {
                    select: {
                      miembro: {
                        select: { id: true, nombre: true, fotoUrl: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.miembro.count(),
    ]);

    await this.prisma.lecturaChat.upsert({
      where: { miembroId_sala: { miembroId: autorId, sala } },
      create: { miembroId: autorId, sala, leidoHasta: mensaje.createdAt },
      update: { leidoHasta: mensaje.createdAt },
    });

    const resultado = this.serializarMensaje(mensaje, autorId, totalMiembros);
    this.gateway.emitir(sala, 'chat:mensaje', resultado);
    return resultado;
  }

  async votarEncuesta(mensajeId: number, miembroId: number, opcionId: number) {
    const mensaje = await this.prisma.mensajeChat.findUnique({
      where: { id: mensajeId },
      include: { encuesta: { include: { opciones: true } } },
    });
    if (!mensaje || !mensaje.encuesta) {
      throw new NotFoundException('Encuesta no encontrada');
    }
    this.verificarAcceso(mensaje.sala, miembroId);

    const opcionValida = mensaje.encuesta.opciones.some(
      (o) => o.id === opcionId,
    );
    if (!opcionValida) {
      throw new BadRequestException('Esa opción no pertenece a esta encuesta');
    }

    await this.prisma.votoEncuestaChat.upsert({
      where: {
        encuestaId_miembroId: { encuestaId: mensaje.encuesta.id, miembroId },
      },
      create: { encuestaId: mensaje.encuesta.id, opcionId, miembroId },
      update: { opcionId },
    });

    const [opcionesConVotos, totalMiembros] = await Promise.all([
      this.prisma.opcionEncuestaChat.findMany({
        where: { encuestaId: mensaje.encuesta.id },
        include: {
          votos: {
            select: {
              miembro: { select: { id: true, nombre: true, fotoUrl: true } },
            },
          },
        },
      }),
      this.prisma.miembro.count(),
    ]);
    const anonima = mensaje.encuesta.anonima;
    const resultadoOpciones = opcionesConVotos.map((o) => ({
      id: o.id,
      texto: o.texto,
      votos: o.votos.length,
      votantes: anonima ? [] : o.votos.map((v) => v.miembro),
    }));
    const totalVotos = resultadoOpciones.reduce((acc, o) => acc + o.votos, 0);

    this.gateway.emitir(mensaje.sala, 'chat:encuesta', {
      mensajeId,
      sala: mensaje.sala,
      opciones: resultadoOpciones,
      totalVotos,
      totalMiembros,
    });

    return {
      id: mensaje.encuesta.id,
      anonima,
      opciones: resultadoOpciones,
      totalVotos,
      totalMiembros,
      miVotoOpcionId: opcionId,
    };
  }

  // Borrado real (no "oculto para mí") de los mensajes que ya superaron su
  // vigencia — DIAS_VIGENCIA_GRUPAL para el grupal, DIAS_VIGENCIA_CHAT para
  // un DM — llamado por ChatLimpiezaScheduler una vez al día. Mismo orden de
  // borrado que eliminarMensaje() (limpiar referencias antes de borrar), pero
  // en lote por antigüedad en vez de por id puntual.
  async purgarMensajesVencidos(): Promise<number> {
    const limiteGrupal = this.limiteVigencia(true);
    const limiteDm = this.limiteVigencia(false);
    const vencidos = await this.prisma.mensajeChat.findMany({
      where: {
        OR: [
          { sala: SALA_GRUPAL, createdAt: { lt: limiteGrupal } },
          { sala: { not: SALA_GRUPAL }, createdAt: { lt: limiteDm } },
        ],
      },
      select: { id: true, adjuntoUrl: true },
    });
    if (vencidos.length === 0) return 0;

    const ids = vencidos.map((m) => m.id);
    const urlsAdjuntos = [
      ...new Set(
        vencidos.map((m) => m.adjuntoUrl).filter((url): url is string => !!url),
      ),
    ];
    await this.prisma.mensajeChat.updateMany({
      where: { respuestaAId: { in: ids } },
      data: { respuestaAId: null },
    });
    await this.prisma.mensajeChat.updateMany({
      where: { reenviadoDeId: { in: ids } },
      data: { reenviadoDeId: null },
    });
    await this.prisma.reaccionMensajeChat.deleteMany({
      where: { mensajeId: { in: ids } },
    });
    await this.prisma.mensajeChatOculto.deleteMany({
      where: { mensajeId: { in: ids } },
    });
    const encuestas = await this.prisma.encuestaChat.findMany({
      where: { mensajeId: { in: ids } },
      select: { id: true },
    });
    if (encuestas.length > 0) {
      const encuestaIds = encuestas.map((e) => e.id);
      await this.prisma.votoEncuestaChat.deleteMany({
        where: { encuestaId: { in: encuestaIds } },
      });
      await this.prisma.opcionEncuestaChat.deleteMany({
        where: { encuestaId: { in: encuestaIds } },
      });
      await this.prisma.encuestaChat.deleteMany({
        where: { id: { in: encuestaIds } },
      });
    }
    await this.prisma.mensajeChat.deleteMany({ where: { id: { in: ids } } });
    for (const url of urlsAdjuntos) {
      await this.borrarArchivoSiNoSeUsa(url);
    }

    return ids.length;
  }

  // Server-side, un solo request con loop interno por destinatario — mismo
  // patrón que PostsService.compartir(), no el patrón cliente-hace-loop que
  // hoy usa el flujo de compartir emprendedor desde Impulsa.
  async reenviarMensaje(
    mensajeId: number,
    autorId: number,
    destinatarioIds: number[],
  ) {
    const original = await this.prisma.mensajeChat.findUnique({
      where: { id: mensajeId },
    });
    if (!original) throw new NotFoundException('Mensaje no encontrado');
    this.verificarAcceso(original.sala, autorId);
    if (original.adjuntoTipo === 'encuesta') {
      throw new BadRequestException('No se puede reenviar una encuesta');
    }

    const idsUnicos = [...new Set(destinatarioIds)].filter(
      (id) => id !== autorId,
    );
    if (
      idsUnicos.length === 0 ||
      idsUnicos.length > MAX_REENVIO_DESTINATARIOS
    ) {
      throw new BadRequestException(
        `Elige entre 1 y ${MAX_REENVIO_DESTINATARIOS} destinatarios`,
      );
    }
    const destinatarios = await this.prisma.miembro.findMany({
      where: { id: { in: idsUnicos } },
    });
    if (destinatarios.length !== idsUnicos.length) {
      throw new BadRequestException('Uno de los destinatarios no existe');
    }

    for (const destinatarioId of idsUnicos) {
      const sala = this.salaIndividual(autorId, destinatarioId);
      await this.enviarMensaje(
        sala,
        autorId,
        {
          texto: original.texto,
          adjuntoTipo: original.adjuntoTipo as MensajeDto['adjuntoTipo'],
          adjuntoUrl: original.adjuntoUrl ?? undefined,
          adjuntoUbicacionNombre: original.adjuntoUbicacionNombre ?? undefined,
          adjuntoUbicacionLat: original.adjuntoUbicacionLat ?? undefined,
          adjuntoUbicacionLon: original.adjuntoUbicacionLon ?? undefined,
          adjuntoRutaDistanciaKm: original.adjuntoRutaDistanciaKm ?? undefined,
          adjuntoRutaDuracionSeg: original.adjuntoRutaDuracionSeg ?? undefined,
          adjuntoRutaPuntos: original.adjuntoRutaPuntos ?? undefined,
          adjuntoArchivoNombre: original.adjuntoArchivoNombre ?? undefined,
          adjuntoArchivoTamanoKb: original.adjuntoArchivoTamanoKb ?? undefined,
          adjuntoAudioDuracionSeg:
            original.adjuntoAudioDuracionSeg ?? undefined,
        },
        mensajeId,
      );
    }
    return { reenviadoA: idsUnicos.length };
  }

  // Cursores de lectura/entrega de una sala — usado por el frontend para
  // calcular los checks de enviado/entregado/leído de sus propios mensajes
  // (con quién comparar depende de sala, ver useConversacion.ts).
  async lecturaDeSala(sala: string, miembroId: number) {
    this.verificarAcceso(sala, miembroId);
    const lecturas = await this.prisma.lecturaChat.findMany({
      where: { sala },
    });
    return lecturas.map((l) => ({
      miembroId: l.miembroId,
      leidoHasta: l.leidoHasta,
      entregadoHasta: l.entregadoHasta,
    }));
  }

  // Estado combinado para el encabezado del chat 1 a 1 (prioridad de mayor a
  // menor): patinando ahora/en ruta > en línea > última conexión.
  async estadoDeMiembro(otroId: number) {
    const limite = new Date(
      Date.now() - HORAS_VIGENCIA_PATINANDO * 60 * 60 * 1000,
    );
    const ubicacion = await this.prisma.ubicacionActiva.findUnique({
      where: { miembroId: otroId },
    });
    const patinando =
      ubicacion && ubicacion.actualizadoEn >= limite
        ? (ubicacion.modo as 'patinando' | 'ruta')
        : null;

    const enLinea = this.presencia.estaConectado(otroId);
    const miembro = await this.prisma.miembro.findUnique({
      where: { id: otroId },
      select: { ultimaConexion: true },
    });

    return {
      patinando,
      enLinea,
      ultimaConexion: miembro?.ultimaConexion ?? null,
    };
  }

  async miembros() {
    return this.prisma.miembro.findMany({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, fotoUrl: true },
    });
  }

  // Mismo criterio que `conversaciones()`: no hay forma de indexar las salas
  // DM por participante, así que se traen todos los mensajes de tipo "post" o
  // "emprendedor" no míos y se filtra en memoria cuáles salas me incluyen.
  async compartidosSinLeer(miembroId: number) {
    // Esta consulta ya está acotada a salas "dm-*" más abajo, así que siempre
    // usa la vigencia de DM.
    const limite = this.limiteVigencia(false);

    const mensajes = await this.prisma.mensajeChat.findMany({
      where: {
        referenciaTipo: { in: ['post', 'emprendedor'] },
        autorId: { not: miembroId },
        sala: { startsWith: 'dm-' },
        createdAt: { gte: limite },
      },
      orderBy: { createdAt: 'desc' },
      include: { autor: { select: { nombre: true, fotoUrl: true } } },
    });

    const propias = mensajes.filter((m) => {
      const par = this.parseSalaIndividual(m.sala);
      return par !== null && par.includes(miembroId);
    });
    if (propias.length === 0) return [];

    const salas = [...new Set(propias.map((m) => m.sala))];
    const lecturas = await this.prisma.lecturaChat.findMany({
      where: { miembroId, sala: { in: salas } },
    });
    const leidoHastaPorSala = new Map(
      lecturas.map((l) => [l.sala, l.leidoHasta]),
    );

    return propias
      .filter(
        (m) => m.createdAt > (leidoHastaPorSala.get(m.sala) ?? new Date(0)),
      )
      .map((m) => ({
        mensajeId: m.id,
        sala: m.sala,
        tipo: m.referenciaTipo as 'post' | 'emprendedor',
        referenciaId: m.referenciaId as number,
        autorNombre: m.autor.nombre,
        autorFotoUrl: m.autor.fotoUrl,
        createdAt: m.createdAt,
      }));
  }
}
