import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesPushService } from '../notificaciones-push/notificaciones-push.service';
import { EmergenciasService } from './emergencias.service';

// Diseño acordado con el usuario para el caso "el accidentado se olvida de
// cancelar el SOS": hoy nadie más que el propio dueño puede apagarlo (salvo
// un Admin, ver EmergenciasController) y si no lo hace queda parpadeando en
// el mapa de todos indefinidamente. A los MIN_AVISO_SOS minutos le llega un
// push recordatorio para que lo cancele él mismo si ya está bien; a los
// MIN_VENCIMIENTO_SOS se cancela sola. No hace de red de seguridad real (esa
// la cubre el botón de llamada a emergencia de la app), así que este
// vencimiento es aceptable aunque la persona esté genuinamente incapacitada.
const MIN_AVISO_SOS = 20;
const MIN_VENCIMIENTO_SOS = 40;

@Injectable()
export class EmergenciaVencimientoScheduler {
  private readonly logger = new Logger(EmergenciaVencimientoScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesPushService: NotificacionesPushService,
    private emergenciasService: EmergenciasService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async revisar() {
    await this.enviarRecordatorios();
    await this.vencerActivas();
  }

  private async enviarRecordatorios() {
    const limite = new Date(Date.now() - MIN_AVISO_SOS * 60 * 1000);
    const candidatas = await this.prisma.emergencia.findMany({
      where: { activa: true, createdAt: { lte: limite }, avisoEnviado: false },
    });

    for (const emergencia of candidatas) {
      await this.notificacionesPushService.enviarAMiembros(
        [emergencia.miembroId],
        {
          titulo: '🚨 ¿Seguís necesitando ayuda?',
          cuerpo: 'Tu SOS sigue activo. Tocá para cancelarlo si ya estás bien.',
          url: '/mapa',
        },
      );
      await this.prisma.emergencia.update({
        where: { id: emergencia.id },
        data: { avisoEnviado: true },
      });
      this.logger.log(
        `Recordatorio de SOS enviado a miembro #${emergencia.miembroId}`,
      );
    }
  }

  // Reutiliza EmergenciasService.cancelar() -- misma lógica y mismo aviso de
  // cancelación por socket que si lo hubiera cancelado el propio dueño o un
  // Admin, así el mapa y el banner de todos se actualizan igual.
  private async vencerActivas() {
    const limite = new Date(Date.now() - MIN_VENCIMIENTO_SOS * 60 * 1000);
    const vencidas = await this.prisma.emergencia.findMany({
      where: { activa: true, createdAt: { lte: limite } },
    });

    for (const emergencia of vencidas) {
      await this.emergenciasService.cancelar(emergencia.miembroId);
      this.logger.log(
        `SOS vencido a los ${MIN_VENCIMIENTO_SOS} min, cancelado automáticamente: miembro #${emergencia.miembroId}`,
      );
    }
  }
}
