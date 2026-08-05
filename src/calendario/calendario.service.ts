import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesPushService } from '../notificaciones-push/notificaciones-push.service';
import { CrearActividadDto } from './dto/crear-actividad.dto';
import { ActualizarActividadDto } from './dto/actualizar-actividad.dto';
import { feriadosDelMes } from '../common/feriados-chile.util';

const ETIQUETA_CATEGORIA: Record<string, string> = {
  rodada: 'Rodada oficial',
  evento: 'Evento',
  entrenamiento: 'Entrenamiento',
  reunion: 'Reunión',
  patinada_libre: 'Patinada libre',
  otros: 'Otros',
};

// Un item unificado del calendario: puede venir de una Publicacion oficial
// (rodada/evento del Admin, con RSVP), de una ActividadCalendario (creada
// por cualquier miembro, con invitados propios) o de un cumpleaños calculado
// en vivo desde Miembro.fechaNacimiento — nunca se guarda una fila aparte
// para los cumpleaños, se recalculan cada vez que se pide el mes.
export interface ItemCalendario {
  origen: 'publicacion' | 'actividad' | 'cumpleanos' | 'feriado';
  id: number;
  categoria: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora: string | null;
  puntoEncuentro: string | null;
  fotoUrl: string | null;
  cancelada: boolean;
  esCreador: boolean;
}

function rangoMes(anio: number, mes: number): { desde: string; hasta: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return {
    desde: `${anio}-${pad(mes)}-01`,
    hasta: `${anio}-${pad(mes)}-${pad(ultimoDia)}`,
  };
}

@Injectable()
export class CalendarioService {
  constructor(
    private prisma: PrismaService,
    private notificacionesPushService: NotificacionesPushService,
  ) {}

  async crearActividad(creadorId: number, dto: CrearActividadDto) {
    const invitadosIds = Array.from(new Set(dto.invitadosIds ?? [])).filter(
      (id) => id !== creadorId,
    );

    const actividad = await this.prisma.actividadCalendario.create({
      data: {
        creadorId,
        categoria: dto.categoria,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        fecha: dto.fecha,
        hora: dto.hora,
        puntoEncuentro: dto.puntoEncuentro,
        puntoLat: dto.puntoLat,
        puntoLon: dto.puntoLon,
        fotoUrl: dto.fotoUrl,
        musicaId: dto.musicaId,
        minutosAvisoCreador: dto.minutosAvisoCreador,
        invitados: {
          create: invitadosIds.map((miembroId) => ({ miembroId })),
        },
      },
      include: { creador: { select: { nombre: true } } },
    });

    if (invitadosIds.length > 0) {
      await this.notificacionesPushService.enviarAMiembros(invitadosIds, {
        titulo: `📅 ${ETIQUETA_CATEGORIA[dto.categoria] ?? dto.categoria}`,
        cuerpo: `${actividad.creador.nombre} te invitó: ${dto.titulo}`,
        url: '/perfil',
      });
    }

    return actividad;
  }

  async responderInvitacion(
    miembroId: number,
    actividadId: number,
    estado: string,
  ) {
    const invitacion = await this.prisma.invitacionActividad.findUnique({
      where: { actividadId_miembroId: { actividadId, miembroId } },
    });
    if (!invitacion) {
      throw new NotFoundException('No fuiste invitado a esta actividad.');
    }
    return this.prisma.invitacionActividad.update({
      where: { id: invitacion.id },
      data: { estado },
    });
  }

  // Detalle completo de una actividad propia — a diferencia de ItemCalendario
  // (pensado para la vista de mes), esto incluye todo lo necesario para
  // prellenar el formulario de edición (invitadosIds, musicaId, etc.).
  async obtenerActividad(miembroId: number, actividadId: number) {
    const actividad = await this.prisma.actividadCalendario.findUnique({
      where: { id: actividadId },
      include: { invitados: true },
    });
    if (!actividad) throw new NotFoundException('Actividad no encontrada.');
    if (actividad.creadorId !== miembroId) {
      throw new ForbiddenException(
        'Solo quien creó la actividad puede verla para editar.',
      );
    }
    return {
      id: actividad.id,
      categoria: actividad.categoria,
      titulo: actividad.titulo,
      descripcion: actividad.descripcion,
      fecha: actividad.fecha,
      hora: actividad.hora,
      puntoEncuentro: actividad.puntoEncuentro,
      puntoLat: actividad.puntoLat,
      puntoLon: actividad.puntoLon,
      fotoUrl: actividad.fotoUrl,
      musicaId: actividad.musicaId,
      minutosAvisoCreador: actividad.minutosAvisoCreador,
      cancelada: actividad.cancelada,
      invitadosIds: actividad.invitados.map((i) => i.miembroId),
    };
  }

  async editarActividad(
    miembroId: number,
    actividadId: number,
    dto: ActualizarActividadDto,
  ) {
    const actividad = await this.prisma.actividadCalendario.findUnique({
      where: { id: actividadId },
      include: { invitados: true },
    });
    if (!actividad) throw new NotFoundException('Actividad no encontrada.');
    if (actividad.creadorId !== miembroId) {
      throw new ForbiddenException(
        'Solo quien creó la actividad puede editarla.',
      );
    }
    if (actividad.cancelada) {
      throw new ForbiddenException(
        'No se puede editar una actividad cancelada.',
      );
    }

    const actualizada = await this.prisma.actividadCalendario.update({
      where: { id: actividadId },
      data: {
        categoria: dto.categoria,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        fecha: dto.fecha,
        hora: dto.hora,
        puntoEncuentro: dto.puntoEncuentro,
        puntoLat: dto.puntoLat,
        puntoLon: dto.puntoLon,
        fotoUrl: dto.fotoUrl,
        musicaId: dto.musicaId,
        minutosAvisoCreador: dto.minutosAvisoCreador,
      },
    });

    if (dto.invitadosIds) {
      const nuevosIds = Array.from(new Set(dto.invitadosIds)).filter(
        (id) => id !== miembroId,
      );
      const existentesIds = actividad.invitados.map((i) => i.miembroId);
      const aAgregar = nuevosIds.filter((id) => !existentesIds.includes(id));
      const aQuitar = existentesIds.filter((id) => !nuevosIds.includes(id));

      if (aQuitar.length > 0) {
        await this.prisma.invitacionActividad.deleteMany({
          where: { actividadId, miembroId: { in: aQuitar } },
        });
      }
      if (aAgregar.length > 0) {
        await this.prisma.invitacionActividad.createMany({
          data: aAgregar.map((idMiembro) => ({
            actividadId,
            miembroId: idMiembro,
          })),
        });
        await this.notificacionesPushService.enviarAMiembros(aAgregar, {
          titulo: `📅 ${ETIQUETA_CATEGORIA[actualizada.categoria] ?? actualizada.categoria}`,
          cuerpo: `Te invitaron: ${actualizada.titulo}`,
          url: '/perfil',
        });
      }
    }

    return actualizada;
  }

  async cancelarActividad(miembroId: number, actividadId: number) {
    const actividad = await this.prisma.actividadCalendario.findUnique({
      where: { id: actividadId },
    });
    if (!actividad) throw new NotFoundException('Actividad no encontrada.');
    if (actividad.creadorId !== miembroId) {
      throw new ForbiddenException(
        'Solo quien creó la actividad puede cancelarla.',
      );
    }
    return this.prisma.actividadCalendario.update({
      where: { id: actividadId },
      data: { cancelada: true },
    });
  }

  // Para la campana: invitaciones que todavía no respondiste — se recalcula
  // en vivo cada vez que se consulta (mismo criterio que proximaRodada en
  // publicaciones.service.ts), así que desaparece sola apenas aceptás o
  // rechazás, sin necesitar un flag de "leída" aparte.
  async misInvitacionesPendientes(miembroId: number) {
    const invitaciones = await this.prisma.invitacionActividad.findMany({
      where: {
        miembroId,
        estado: 'pendiente',
        actividad: { cancelada: false },
      },
      include: {
        actividad: { include: { creador: { select: { nombre: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invitaciones.map((inv) => ({
      id: inv.id,
      actividadId: inv.actividadId,
      categoria: inv.actividad.categoria,
      titulo: inv.actividad.titulo,
      fecha: inv.actividad.fecha,
      hora: inv.actividad.hora,
      fotoUrl: inv.actividad.fotoUrl,
      creadorNombre: inv.actividad.creador.nombre,
    }));
  }

  async listarMes(
    miembroId: number,
    anio: number,
    mes: number,
  ): Promise<ItemCalendario[]> {
    const { desde, hasta } = rangoMes(anio, mes);
    const items: ItemCalendario[] = [];

    const publicaciones = await this.prisma.publicacion.findMany({
      where: {
        tipo: { in: ['rodada', 'evento'] },
        fecha: { gte: desde, lte: hasta },
        rsvps: { some: { miembroId, estado: 'yes' } },
      },
    });
    for (const p of publicaciones) {
      items.push({
        origen: 'publicacion',
        id: p.id,
        categoria: p.tipo,
        titulo: p.titulo,
        descripcion: null,
        fecha: p.fecha as string,
        hora: p.hora,
        puntoEncuentro: p.puntoEncuentro,
        fotoUrl: null,
        cancelada: p.cancelada,
        esCreador: false,
      });
    }

    const actividades = await this.prisma.actividadCalendario.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
        OR: [
          { creadorId: miembroId },
          { invitados: { some: { miembroId, estado: 'aceptada' } } },
        ],
      },
    });
    for (const a of actividades) {
      items.push({
        origen: 'actividad',
        id: a.id,
        categoria: a.categoria,
        titulo: a.titulo,
        descripcion: a.descripcion,
        fecha: a.fecha,
        hora: a.hora,
        puntoEncuentro: a.puntoEncuentro,
        fotoUrl: a.fotoUrl,
        cancelada: a.cancelada,
        esCreador: a.creadorId === miembroId,
      });
    }

    const miembros = await this.prisma.miembro.findMany({
      where: { fechaNacimiento: { not: null } },
      select: { id: true, nombre: true, fotoUrl: true, fechaNacimiento: true },
    });
    for (const m of miembros) {
      const nacimiento = m.fechaNacimiento as Date;
      const mesNac = nacimiento.getUTCMonth() + 1;
      if (mesNac !== mes) continue;
      const dia = nacimiento.getUTCDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      items.push({
        origen: 'cumpleanos',
        id: m.id,
        categoria: 'cumpleanos',
        titulo: `Cumpleaños de ${m.nombre}`,
        descripcion: null,
        fecha: `${anio}-${pad(mes)}-${pad(dia)}`,
        hora: null,
        puntoEncuentro: null,
        fotoUrl: m.fotoUrl,
        cancelada: false,
        esCreador: false,
      });
    }

    feriadosDelMes(anio, mes).forEach((f, idx) => {
      items.push({
        origen: 'feriado',
        id: -(idx + 1),
        categoria: 'feriado',
        titulo: f.nombre,
        descripcion: null,
        fecha: f.fecha,
        hora: null,
        puntoEncuentro: null,
        fotoUrl: null,
        cancelada: false,
        esCreador: false,
      });
    });

    return items.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
}
