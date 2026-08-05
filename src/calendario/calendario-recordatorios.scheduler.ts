import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesPushService } from '../notificaciones-push/notificaciones-push.service';
import { combinarFechaHoraChile } from '../common/fecha-chile.util';

// Mismo criterio que RecordatoriosScheduler (publicaciones/rodadas): un
// aviso fijo, no configurable, que le llega a todos los que confirmaron —
// pensado justo para que quien vive lejos del punto de encuentro tenga un
// día entero de margen para organizarse (no solo 30 min).
const MINUTOS_AVISO_24H = 24 * 60;

@Injectable()
export class CalendarioRecordatoriosScheduler {
  private readonly logger = new Logger(CalendarioRecordatoriosScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesPushService: NotificacionesPushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async revisarRecordatorios() {
    const candidatas = await this.prisma.actividadCalendario.findMany({
      where: {
        cancelada: false,
        fecha: { not: '' },
        hora: { not: null },
        OR: [{ aviso24hEnviado: false }, { avisoCreadorEnviado: false }],
      },
      include: {
        invitados: {
          where: { estado: 'aceptada' },
          select: { miembroId: true },
        },
      },
    });

    for (const actividad of candidatas) {
      const fechaHora = combinarFechaHoraChile(actividad.fecha, actividad.hora);
      if (!fechaHora) continue;
      const minutosFaltan = (fechaHora.getTime() - Date.now()) / (60 * 1000);
      if (minutosFaltan <= 0) continue;

      const destinatarios = [
        actividad.creadorId,
        ...actividad.invitados.map((i) => i.miembroId),
      ];

      if (!actividad.aviso24hEnviado && minutosFaltan <= MINUTOS_AVISO_24H) {
        await this.notificacionesPushService.enviarAMiembros(destinatarios, {
          titulo: '📅 Actividad mañana',
          cuerpo: actividad.puntoEncuentro
            ? `${actividad.titulo} · ${actividad.puntoEncuentro}`
            : actividad.titulo,
          url: '/perfil',
        });
        await this.prisma.actividadCalendario.update({
          where: { id: actividad.id },
          data: { aviso24hEnviado: true },
        });
        this.logger.log(`Aviso 24h enviado para actividad #${actividad.id}`);
      }

      if (
        !actividad.avisoCreadorEnviado &&
        actividad.minutosAvisoCreador &&
        minutosFaltan <= actividad.minutosAvisoCreador
      ) {
        await this.notificacionesPushService.enviarAMiembros(
          [actividad.creadorId],
          {
            titulo: '📅 Tu actividad está por empezar',
            cuerpo: actividad.puntoEncuentro
              ? `${actividad.titulo} · ${actividad.puntoEncuentro}`
              : actividad.titulo,
            url: '/perfil',
          },
        );
        await this.prisma.actividadCalendario.update({
          where: { id: actividad.id },
          data: { avisoCreadorEnviado: true },
        });
        this.logger.log(
          `Aviso personal del creador enviado para actividad #${actividad.id}`,
        );
      }
    }
  }
}
