import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesPushService } from '../notificaciones-push/notificaciones-push.service';

// Mismo valor que MIN_AVISO_INACTIVIDAD en MapaView.tsx (frontend) -- este es
// el backup por push del aviso que ya se muestra en pantalla, para que
// llegue aunque el celular esté con la pantalla bloqueada (ese aviso depende
// de un timer de JS que solo corre con la app en primer plano). A propósito
// NO se replica acá el cierre automático de sesión a los 10 minutos
// siguientes: el detalle del recorrido (trazado/distancia) solo vive en la
// memoria del navegador mientras la app está abierta, así que forzar el
// cierre desde el backend perdería esa actividad en vez de guardarla. Ese
// cierre lo sigue haciendo la app cuando el usuario la vuelve a abrir.
const MIN_AVISO_INACTIVIDAD = 25;

@Injectable()
export class MapaInactividadScheduler {
  private readonly logger = new Logger(MapaInactividadScheduler.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesPushService: NotificacionesPushService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async revisarInactividad() {
    const limite = new Date(Date.now() - MIN_AVISO_INACTIVIDAD * 60 * 1000);
    const candidatos = await this.prisma.ubicacionActiva.findMany({
      where: { movimientoEn: { lte: limite }, avisoInactividadEnviado: false },
    });

    for (const ubicacion of candidatos) {
      await this.notificacionesPushService.enviarAMiembros(
        [ubicacion.miembroId],
        {
          titulo: '⏸️ ¿Seguís patinando?',
          cuerpo: `No detectamos movimiento en los últimos ${MIN_AVISO_INACTIVIDAD} minutos.`,
          url: '/mapa',
        },
      );

      await this.prisma.ubicacionActiva.update({
        where: { id: ubicacion.id },
        data: { avisoInactividadEnviado: true },
      });

      this.logger.log(
        `Aviso de inactividad enviado a miembro #${ubicacion.miembroId}`,
      );
    }
  }
}
