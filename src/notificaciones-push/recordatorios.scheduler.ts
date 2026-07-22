import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesPushService } from './notificaciones-push.service';

const TIPOS_CON_RECORDATORIO = ['rodada', 'evento', 'anuncio'] as const;
const MINUTOS_ANTES_RECORDATORIO = 30;

const ETIQUETA_TIPO: Record<(typeof TIPOS_CON_RECORDATORIO)[number], string> = {
  rodada: 'Rodada programada',
  evento: 'Evento y actividad',
  anuncio: 'Anuncio y celebración',
};

// Envía un push 30 minutos antes de la fecha+hora de una rodada/evento/anuncio
// (ajuste post-Fase 12, ver PROGRESS.md) solo a quienes respondieron RSVP
// "Voy" o "Tal vez" para esa publicación puntual.
@Injectable()
export class RecordatoriosScheduler {
  private readonly logger = new Logger(RecordatoriosScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesPushService: NotificacionesPushService,
  ) {}

  private combinarFechaHora(
    fecha: string | null,
    hora: string | null,
  ): Date | null {
    if (!fecha) return null;
    const d = new Date(`${fecha}T${hora ?? '00:00'}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async revisarRecordatorios() {
    const candidatas = await this.prisma.publicacion.findMany({
      where: {
        tipo: { in: [...TIPOS_CON_RECORDATORIO] },
        fecha: { not: null },
        hora: { not: null },
        recordatorioEnviado: false,
      },
    });

    for (const publicacion of candidatas) {
      const fechaHora = this.combinarFechaHora(
        publicacion.fecha,
        publicacion.hora,
      );
      if (!fechaHora) continue;

      const diffMs = fechaHora.getTime() - Date.now();
      const ventanaMs = MINUTOS_ANTES_RECORDATORIO * 60 * 1000;
      if (diffMs <= 0 || diffMs > ventanaMs) continue;

      const etiqueta =
        ETIQUETA_TIPO[
          publicacion.tipo as (typeof TIPOS_CON_RECORDATORIO)[number]
        ] ?? publicacion.tipo;

      const rsvps = await this.prisma.rsvpRespuesta.findMany({
        where: {
          publicacionId: publicacion.id,
          estado: { in: ['yes', 'maybe'] },
        },
        select: { miembroId: true },
      });

      await this.notificacionesPushService.enviarAMiembros(
        rsvps.map((r) => r.miembroId),
        {
          titulo: `🔔 ${etiqueta} en ${MINUTOS_ANTES_RECORDATORIO} minutos`,
          cuerpo: publicacion.puntoEncuentro
            ? `${publicacion.titulo} · ${publicacion.puntoEncuentro}`
            : publicacion.titulo,
          url: '/comunidad',
        },
      );

      await this.prisma.publicacion.update({
        where: { id: publicacion.id },
        data: { recordatorioEnviado: true },
      });

      this.logger.log(
        `Recordatorio enviado para publicación #${publicacion.id}`,
      );
    }
  }
}
