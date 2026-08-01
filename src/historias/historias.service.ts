import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearHistoriaDto } from './dto/crear-historia.dto';
import { HistoriasGateway } from './historias.gateway';
import { borrarArchivoSubido } from '../common/uploads-fs.util';

const HORAS_VIGENCIA_HISTORIA = 24;
const MAX_HISTORIAS_ACTIVAS = 10;
const MAX_MENCIONES_POR_HISTORIA = 5;

// Orden de la barra de historias: sin sistema de "amigos", la afinidad con
// cada autor se infiere de cuánto interactuás con esa persona en una
// ventana reciente (no de todo el historial — así el ranking se va
// actualizando solo a medida que las relaciones cambian o el club crece,
// sin tener que tocar el algoritmo). Un mensaje de chat pesa más que un
// comentario y un comentario más que una reacción, porque escribirle a
// alguien es una señal más intencional que tocar un botón.
const DIAS_VENTANA_AFINIDAD = 30;
const PESO_MENSAJE_CHAT = 3;
const PESO_COMENTARIO = 2;
const PESO_REACCION = 1;

@Injectable()
export class HistoriasService {
  constructor(
    private prisma: PrismaService,
    private gateway: HistoriasGateway,
  ) {}

  private limiteVigencia() {
    return new Date(Date.now() - HORAS_VIGENCIA_HISTORIA * 60 * 60 * 1000);
  }

  // Puntaje de afinidad con cada candidato, sumando (en cualquiera de las
  // dos direcciones) mensajes de chat 1 a 1, reacciones y comentarios en
  // Post/Historia, todo dentro de los últimos DIAS_VENTANA_AFINIDAD días.
  // No distingue "recibido" de "dado": ambas direcciones son señal real de
  // interés mutuo, y sumarlas es más simple que ponderarlas aparte.
  private async calcularAfinidad(
    miembroIdActual: number,
    candidatos: number[],
  ): Promise<Map<number, number>> {
    const puntos = new Map<number, number>(candidatos.map((id) => [id, 0]));
    if (candidatos.length === 0) return puntos;

    const limite = new Date(
      Date.now() - DIAS_VENTANA_AFINIDAD * 24 * 60 * 60 * 1000,
    );
    function sumar(id: number, valor: number) {
      puntos.set(id, (puntos.get(id) ?? 0) + valor);
    }

    // La sala de un DM es determinística ("dm-{idMenor}-{idMayor}"), así
    // que se arma la lista de salas candidatas y se cuenta todo en una sola
    // consulta agrupada, en vez de una consulta por persona.
    const salaPorCandidato = new Map(
      candidatos.map((id) => [
        `dm-${Math.min(miembroIdActual, id)}-${Math.max(miembroIdActual, id)}`,
        id,
      ]),
    );
    const [
      mensajes,
      reaccionesPostRecibidas,
      reaccionesPostDadas,
      comentariosPostRecibidos,
      comentariosPostDados,
      reaccionesHistoriaRecibidas,
      reaccionesHistoriaDadas,
      comentariosHistoriaRecibidos,
      comentariosHistoriaDados,
    ] = await Promise.all([
      this.prisma.mensajeChat.groupBy({
        by: ['sala'],
        where: {
          sala: { in: [...salaPorCandidato.keys()] },
          createdAt: { gte: limite },
        },
        _count: { _all: true },
      }),
      this.prisma.reaccionPost.groupBy({
        by: ['miembroId'],
        where: {
          miembroId: { in: candidatos },
          createdAt: { gte: limite },
          post: { autorId: miembroIdActual },
        },
        _count: { _all: true },
      }),
      this.prisma.reaccionPost.findMany({
        where: {
          miembroId: miembroIdActual,
          createdAt: { gte: limite },
          post: { autorId: { in: candidatos } },
        },
        select: { post: { select: { autorId: true } } },
      }),
      this.prisma.comentarioPost.groupBy({
        by: ['autorId'],
        where: {
          autorId: { in: candidatos },
          createdAt: { gte: limite },
          post: { autorId: miembroIdActual },
        },
        _count: { _all: true },
      }),
      this.prisma.comentarioPost.findMany({
        where: {
          autorId: miembroIdActual,
          createdAt: { gte: limite },
          post: { autorId: { in: candidatos } },
        },
        select: { post: { select: { autorId: true } } },
      }),
      this.prisma.reaccionHistoria.groupBy({
        by: ['miembroId'],
        where: {
          miembroId: { in: candidatos },
          createdAt: { gte: limite },
          historia: { autorId: miembroIdActual },
        },
        _count: { _all: true },
      }),
      this.prisma.reaccionHistoria.findMany({
        where: {
          miembroId: miembroIdActual,
          createdAt: { gte: limite },
          historia: { autorId: { in: candidatos } },
        },
        select: { historia: { select: { autorId: true } } },
      }),
      this.prisma.comentarioHistoria.groupBy({
        by: ['autorId'],
        where: {
          autorId: { in: candidatos },
          createdAt: { gte: limite },
          historia: { autorId: miembroIdActual },
        },
        _count: { _all: true },
      }),
      this.prisma.comentarioHistoria.findMany({
        where: {
          autorId: miembroIdActual,
          createdAt: { gte: limite },
          historia: { autorId: { in: candidatos } },
        },
        select: { historia: { select: { autorId: true } } },
      }),
    ]);

    for (const m of mensajes) {
      const id = salaPorCandidato.get(m.sala);
      if (id !== undefined) sumar(id, m._count._all * PESO_MENSAJE_CHAT);
    }
    for (const r of reaccionesPostRecibidas) {
      sumar(r.miembroId, r._count._all * PESO_REACCION);
    }
    for (const r of reaccionesPostDadas) sumar(r.post.autorId, PESO_REACCION);
    for (const c of comentariosPostRecibidos) {
      sumar(c.autorId, c._count._all * PESO_COMENTARIO);
    }
    for (const c of comentariosPostDados) {
      sumar(c.post.autorId, PESO_COMENTARIO);
    }
    for (const r of reaccionesHistoriaRecibidas) {
      sumar(r.miembroId, r._count._all * PESO_REACCION);
    }
    for (const r of reaccionesHistoriaDadas) {
      sumar(r.historia.autorId, PESO_REACCION);
    }
    for (const c of comentariosHistoriaRecibidos) {
      sumar(c.autorId, c._count._all * PESO_COMENTARIO);
    }
    for (const c of comentariosHistoriaDados) {
      sumar(c.historia.autorId, PESO_COMENTARIO);
    }

    return puntos;
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

    const { menciones, ...datosHistoria } = dto;

    if (menciones && menciones.length > 0) {
      if (menciones.length > MAX_MENCIONES_POR_HISTORIA) {
        throw new ConflictException(
          `Solo puedes mencionar hasta ${MAX_MENCIONES_POR_HISTORIA} personas por historia.`,
        );
      }
      const idsUnicos = new Set(menciones.map((m) => m.miembroId));
      if (idsUnicos.size !== menciones.length) {
        throw new ConflictException(
          'No puedes mencionar a la misma persona más de una vez.',
        );
      }
      const existentes = await this.prisma.miembro.count({
        where: { id: { in: [...idsUnicos] } },
      });
      if (existentes !== idsUnicos.size) {
        throw new NotFoundException(
          'Alguno de los miembros mencionados no existe',
        );
      }
    }

    return this.prisma.historia.create({
      data: {
        ...datosHistoria,
        autorId,
        menciones: menciones?.length
          ? {
              create: menciones.map((m) => ({
                miembroId: m.miembroId,
                x: m.x,
                y: m.y,
                escala: m.escala ?? 1,
              })),
            }
          : undefined,
      },
      include: { menciones: true },
    });
  }

  async listarAgrupadas(miembroIdActual: number) {
    const historias = await this.prisma.historia.findMany({
      where: { createdAt: { gte: this.limiteVigencia() } },
      orderBy: { createdAt: 'asc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
        menciones: {
          include: {
            miembro: { select: { id: true, nombre: true, fotoUrl: true } },
          },
        },
        reacciones: { select: { miembroId: true, leida: true } },
        _count: { select: { comentarios: true } },
        // Los Ecos son un concepto aparte de los comentarios (ver EcoHistoria
        // en el schema): quedan fijos sobre la imagen para cualquiera que
        // abra la historia, no solo para quien la vio en vivo — por eso se
        // traen completos acá, no solo un conteo.
        ecos: {
          orderBy: { createdAt: 'asc' },
          include: { autor: { select: { nombre: true, fotoUrl: true } } },
        },
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

    type HistoriaConDatos = (typeof historias)[number] & {
      compartida: boolean;
    };

    const grupos = new Map<
      number,
      {
        autorId: number;
        autorNombre: string;
        autorFotoUrl: string | null;
        historias: HistoriaConDatos[];
      }
    >();

    function agregarA(
      clave: number,
      nombre: string,
      fotoUrl: string | null,
      h: HistoriaConDatos,
    ) {
      const grupo = grupos.get(clave) ?? {
        autorId: clave,
        autorNombre: nombre,
        autorFotoUrl: fotoUrl,
        historias: [],
      };
      grupo.historias.push(h);
      grupos.set(clave, grupo);
    }

    for (const h of historias) {
      agregarA(h.autorId, h.autor.nombre, h.autor.fotoUrl, {
        ...h,
        compartida: false,
      });
      // Cada mención aceptada re-agrupa la MISMA historia también bajo el
      // avatar de esa persona (sin sistema de seguidores, sin duplicar el
      // registro) — hasta 5 personas distintas pueden compartir una historia.
      for (const m of h.menciones) {
        if (m.aceptada) {
          agregarA(m.miembroId, m.miembro.nombre, m.miembro.fotoUrl, {
            ...h,
            compartida: true,
          });
        }
      }
    }

    const candidatosAfinidad = [...grupos.keys()].filter(
      (id) => id !== miembroIdActual,
    );
    const afinidad = await this.calcularAfinidad(
      miembroIdActual,
      candidatosAfinidad,
    );

    return [...grupos.values()]
      .map((g) => ({
        autorId: g.autorId,
        autorNombre: g.autorNombre,
        autorFotoUrl: g.autorFotoUrl,
        vistoCompleto: g.historias.every((h) => idsVistos.has(h.id)),
        // Notificación liviana para el propio autor: hay reacciones sin leer
        // en alguna historia que ÉL creó (no en una compartida de otro autor
        // que solo aparece bajo su avatar por una mención aceptada).
        reaccionesSinLeer:
          g.autorId === miembroIdActual &&
          g.historias.some(
            (h) => !h.compartida && h.reacciones.some((r) => !r.leida),
          ),
        historias: g.historias.map((h) => {
          const miMencion = h.menciones.find(
            (m) => m.miembroId === miembroIdActual,
          );
          return {
            id: h.id,
            autorId: h.autorId,
            autorNombre: h.autor.nombre,
            autorFotoUrl: h.autor.fotoUrl,
            compartida: h.compartida,
            tipo: h.tipo,
            mediaUrl: h.mediaUrl,
            texto: h.texto,
            textoEstilo: h.textoEstilo,
            fotosSticker: h.fotosSticker,
            musicaUrl: h.musicaUrl,
            musicaNombre: h.musicaNombre,
            musicaInicioSeg: h.musicaInicioSeg,
            ubicacion: h.ubicacion,
            menciones: h.menciones.map((m) => ({
              miembroId: m.miembroId,
              nombre: m.miembro.nombre,
              fotoUrl: m.miembro.fotoUrl,
              x: m.x,
              y: m.y,
              escala: m.escala,
              aceptada: m.aceptada,
            })),
            // Notificación de mención: se apaga sola apenas el mencionado ve
            // esta historia (reusa VistaHistoria, no hace falta un campo nuevo).
            mencionSinVer:
              !!miMencion &&
              miMencion.aceptada === null &&
              !idsVistos.has(h.id),
            reaccionesCount: h.reacciones.length,
            miReaccion: h.reacciones.some(
              (r) => r.miembroId === miembroIdActual,
            ),
            comentariosCount: h._count.comentarios,
            ecos: h.ecos.map((e) => ({
              id: e.id,
              miembroId: e.autorId,
              nombre: e.autor.nombre,
              fotoUrl: e.autor.fotoUrl,
              texto: e.texto,
              createdAt: e.createdAt,
            })),
            createdAt: h.createdAt,
          };
        }),
      }))
      .sort((a, b) => {
        if (a.vistoCompleto !== b.vistoCompleto)
          return a.vistoCompleto ? 1 : -1;
        // Sin sistema de "amigos": entre dos autores igual de vistos/sin
        // ver, se prioriza con quién interactuás más (ver calcularAfinidad).
        const puntosA = afinidad.get(a.autorId) ?? 0;
        const puntosB = afinidad.get(b.autorId) ?? 0;
        if (puntosA !== puntosB) return puntosB - puntosA;
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
      await this.prisma.vistaHistoria.create({
        data: { historiaId, miembroId },
      });
    }
    return { vista: true };
  }

  // mediaUrl siempre apunta a /uploads/; fotosSticker es un JSON opaco de
  // {url,x,y,escala,rotacion}[] con más fotos subidas aparte. musicaUrl NO
  // se incluye: es una pista del catálogo propio en /public/musica, no un
  // archivo subido por el usuario (borrarArchivoSubido la ignora igual por
  // no ser /uploads/, pero mejor ni pasarla).
  private urlsArchivosHistoria(historia: {
    mediaUrl: string;
    fotosSticker: string | null;
  }): string[] {
    const urls = [historia.mediaUrl];
    if (historia.fotosSticker) {
      try {
        const stickers = JSON.parse(historia.fotosSticker) as {
          url?: string;
        }[];
        for (const s of stickers) if (s?.url) urls.push(s.url);
      } catch {
        // fotosSticker corrupto/vacío: se ignora, no bloquea el borrado
      }
    }
    return urls;
  }

  async eliminar(id: number, miembroId: number, rol: string) {
    const historia = await this.obtenerOFallar(id);
    if (historia.autorId !== miembroId && rol !== 'admin') {
      throw new ForbiddenException('No puedes eliminar esta historia');
    }
    await this.prisma.vistaHistoria.deleteMany({ where: { historiaId: id } });
    await this.prisma.reaccionHistoria.deleteMany({
      where: { historiaId: id },
    });
    await this.prisma.mencionHistoria.deleteMany({ where: { historiaId: id } });
    await this.prisma.comentarioHistoria.deleteMany({
      where: { historiaId: id },
    });
    await this.prisma.ecoHistoria.deleteMany({ where: { historiaId: id } });
    await this.prisma.historia.delete({ where: { id } });
    for (const url of this.urlsArchivosHistoria(historia)) {
      await borrarArchivoSubido(url);
    }
    return { mensaje: 'Historia eliminada' };
  }

  // Borrado real (no solo el filtro de vigencia que ya aplica listarAgrupadas)
  // de las historias que superaron HORAS_VIGENCIA_HISTORIA — llamado por
  // HistoriasLimpiezaScheduler una vez al día, mismo patrón que
  // ChatService.purgarMensajesVencidos().
  async purgarHistoriasVencidas(): Promise<number> {
    const vencidas = await this.prisma.historia.findMany({
      where: { createdAt: { lt: this.limiteVigencia() } },
      select: { id: true, mediaUrl: true, fotosSticker: true },
    });
    if (vencidas.length === 0) return 0;

    const ids = vencidas.map((h) => h.id);
    await this.prisma.vistaHistoria.deleteMany({
      where: { historiaId: { in: ids } },
    });
    await this.prisma.reaccionHistoria.deleteMany({
      where: { historiaId: { in: ids } },
    });
    await this.prisma.mencionHistoria.deleteMany({
      where: { historiaId: { in: ids } },
    });
    await this.prisma.comentarioHistoria.deleteMany({
      where: { historiaId: { in: ids } },
    });
    await this.prisma.ecoHistoria.deleteMany({
      where: { historiaId: { in: ids } },
    });
    await this.prisma.historia.deleteMany({ where: { id: { in: ids } } });

    for (const historia of vencidas) {
      for (const url of this.urlsArchivosHistoria(historia)) {
        await borrarArchivoSubido(url);
      }
    }
    return ids.length;
  }

  // El corazón de Legión Roller — un solo tipo de reacción, mismo patrón
  // toggle que ReaccionPost. Se guarda como siempre (para el contador y la
  // lista de "quién reaccionó"); si se acaba de agregar (no al quitarla),
  // además se retransmite en vivo a quien esté viendo la historia ahora
  // mismo, como burbuja flotante.
  async toggleReaccion(historiaId: number, miembroId: number, nombre: string) {
    await this.obtenerOFallar(historiaId);
    const existente = await this.prisma.reaccionHistoria.findUnique({
      where: { historiaId_miembroId: { historiaId, miembroId } },
    });

    if (existente) {
      await this.prisma.reaccionHistoria.delete({
        where: { id: existente.id },
      });
    } else {
      await this.prisma.reaccionHistoria.create({
        data: { historiaId, miembroId },
      });
      await this.gateway.emitirReaccion(historiaId, miembroId, nombre);
    }

    const total = await this.prisma.reaccionHistoria.count({
      where: { historiaId },
    });
    return { reaccionesCount: total, miReaccion: !existente };
  }

  // Visible para cualquiera (como "a quién le gustó" en Posts). Solo cuando
  // la consulta el propio autor se marcan como leídas (apaga su notificación
  // liviana) — si la mira otra persona, no debe alterar ese estado.
  async reaccionesDe(historiaId: number, miembroIdSolicitante: number) {
    const historia = await this.obtenerOFallar(historiaId);

    const reacciones = await this.prisma.reaccionHistoria.findMany({
      where: { historiaId },
      orderBy: { createdAt: 'desc' },
      include: {
        miembro: { select: { id: true, nombre: true, fotoUrl: true } },
      },
    });

    if (historia.autorId === miembroIdSolicitante) {
      await this.prisma.reaccionHistoria.updateMany({
        where: { historiaId, leida: false },
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

  // Visible para cualquiera, como los comentarios de un Post — no es un
  // inbox privado del autor. `respuestaAId` deja armar el hilo en el cliente.
  async comentariosDe(historiaId: number) {
    await this.obtenerOFallar(historiaId);

    const comentarios = await this.prisma.comentarioHistoria.findMany({
      where: { historiaId },
      orderBy: { createdAt: 'asc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
      },
    });

    return comentarios.map((c) => ({
      id: c.id,
      miembroId: c.autor.id,
      nombre: c.autor.nombre,
      fotoUrl: c.autor.fotoUrl,
      texto: c.texto,
      respuestaAId: c.respuestaAId,
      createdAt: c.createdAt,
    }));
  }

  // Puede eliminarlo el propio autor del comentario, el dueño de la historia,
  // o un admin — igual criterio que el resto de la app. Se borran también sus
  // respuestas directas (el hilo solo tiene un nivel, así que alcanza con eso).
  async eliminarComentario(
    historiaId: number,
    comentarioId: number,
    miembroId: number,
    rol: string,
  ) {
    const historia = await this.obtenerOFallar(historiaId);
    const comentario = await this.prisma.comentarioHistoria.findUnique({
      where: { id: comentarioId },
    });
    if (!comentario || comentario.historiaId !== historiaId) {
      throw new NotFoundException('Comentario no encontrado');
    }
    const puedeEliminar =
      comentario.autorId === miembroId ||
      historia.autorId === miembroId ||
      rol === 'admin';
    if (!puedeEliminar) {
      throw new ForbiddenException('No puedes eliminar este comentario');
    }

    await this.prisma.comentarioHistoria.deleteMany({
      where: { respuestaAId: comentarioId },
    });
    await this.prisma.comentarioHistoria.delete({
      where: { id: comentarioId },
    });
    return { mensaje: 'Comentario eliminado' };
  }

  // Mismo criterio de permiso que un comentario (autor del eco, autor de la
  // historia, o admin) — un Eco no tiene hilo de respuestas que arrastrar.
  async eliminarEco(
    historiaId: number,
    ecoId: number,
    miembroId: number,
    rol: string,
  ) {
    const historia = await this.obtenerOFallar(historiaId);
    const eco = await this.prisma.ecoHistoria.findUnique({
      where: { id: ecoId },
    });
    if (!eco || eco.historiaId !== historiaId) {
      throw new NotFoundException('Eco no encontrado');
    }
    const puedeEliminar =
      eco.autorId === miembroId ||
      historia.autorId === miembroId ||
      rol === 'admin';
    if (!puedeEliminar) {
      throw new ForbiddenException('No puedes eliminar este eco');
    }

    await this.prisma.ecoHistoria.delete({ where: { id: ecoId } });
    return { mensaje: 'Eco eliminado' };
  }

  // Para la campana del header: comentarios que me incumben y todavía no vi.
  // Dos casos, misma metodología: (a) alguien respondió uno de MIS
  // comentarios, o (b) alguien dejó un comentario raíz en MI historia. Solo
  // cuenta historias que siguen activas (si ya expiró, no hay nada que ir a
  // ver). No se cuenta un comentario/respuesta a uno mismo.
  async respuestasSinLeer(miembroId: number) {
    const comentarios = await this.prisma.comentarioHistoria.findMany({
      where: {
        leida: false,
        autorId: { not: miembroId },
        historia: { createdAt: { gte: this.limiteVigencia() } },
        OR: [
          { respuestaA: { autorId: miembroId } },
          { respuestaAId: null, historia: { autorId: miembroId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        autor: { select: { id: true, nombre: true, fotoUrl: true } },
      },
    });

    return comentarios.map((c) => ({
      id: c.id,
      historiaId: c.historiaId,
      autorNombre: c.autor.nombre,
      autorFotoUrl: c.autor.fotoUrl,
      texto: c.texto,
      createdAt: c.createdAt,
      esRespuesta: c.respuestaAId !== null,
    }));
  }

  // Para la campana: reacciones (corazón) sin leer en MIS historias,
  // AGRUPADAS por historia — si 20 personas reaccionan a la misma historia
  // no queremos 20 filas en la campana, sino una sola con los primeros dos
  // nombres (con foto) y "y otras N personas". Se excluye reaccionar a la
  // propia historia. No hace falta un endpoint aparte para "marcar leída":
  // abrir la pestaña de reacciones del panel (mismo deep-link) ya las marca
  // leídas de una — ver `reaccionesDe()`, que es el mismo mecanismo que usa
  // el puntito liviano del avatar en la barra de Historias.
  async reaccionesSinLeerAgrupadas(miembroId: number) {
    const reacciones = await this.prisma.reaccionHistoria.findMany({
      where: {
        leida: false,
        miembroId: { not: miembroId },
        historia: {
          autorId: miembroId,
          createdAt: { gte: this.limiteVigencia() },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { miembro: { select: { nombre: true, fotoUrl: true } } },
    });

    const porHistoria = new Map<number, typeof reacciones>();
    for (const r of reacciones) {
      const lista = porHistoria.get(r.historiaId) ?? [];
      lista.push(r);
      porHistoria.set(r.historiaId, lista);
    }

    return [...porHistoria.entries()]
      .map(([historiaId, lista]) => ({
        historiaId,
        total: lista.length,
        // Ya viene ordenado desc por createdAt, así que los primeros dos son
        // los más recientes en reaccionar.
        primeros: lista.slice(0, 2).map((r) => ({
          nombre: r.miembro.nombre,
          fotoUrl: r.miembro.fotoUrl,
        })),
        createdAt: lista[0].createdAt,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Solo quien recibe la notificación puede apagarla (evita que cualquiera
  // marque leídas las de otro): quien le respondieron, o el autor de la
  // historia si es un comentario raíz.
  async marcarRespuestaLeida(comentarioId: number, miembroId: number) {
    const comentario = await this.prisma.comentarioHistoria.findUnique({
      where: { id: comentarioId },
      include: {
        respuestaA: { select: { autorId: true } },
        historia: { select: { autorId: true } },
      },
    });
    const autorizado =
      comentario?.respuestaA?.autorId === miembroId ||
      (comentario?.respuestaAId === null &&
        comentario?.historia.autorId === miembroId);
    if (!comentario || !autorizado) {
      throw new ForbiddenException('No puedes marcar esta notificación');
    }
    await this.prisma.comentarioHistoria.update({
      where: { id: comentarioId },
      data: { leida: true },
    });
    return { leida: true };
  }

  // El mencionado decide si la historia también aparece bajo su propio
  // avatar en la barra (sin sistema de seguidores: sigue siendo la misma
  // historia, solo se re-agrupa también bajo él). Solo esa persona puede
  // responder su propia mención.
  async responderMencion(
    historiaId: number,
    miembroId: number,
    aceptar: boolean,
  ) {
    await this.obtenerOFallar(historiaId);
    const mencion = await this.prisma.mencionHistoria.findUnique({
      where: { historiaId_miembroId: { historiaId, miembroId } },
    });
    if (!mencion) {
      throw new ForbiddenException('No fuiste mencionado en esta historia');
    }
    await this.prisma.mencionHistoria.update({
      where: { id: mencion.id },
      data: { aceptada: aceptar },
    });
    return { mencionAceptada: aceptar };
  }

  private async obtenerOFallar(id: number) {
    const historia = await this.prisma.historia.findUnique({ where: { id } });
    if (!historia) throw new NotFoundException('Historia no encontrada');
    return historia;
  }
}
