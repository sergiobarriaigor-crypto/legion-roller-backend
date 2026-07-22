import { Module } from '@nestjs/common';
import { NotificacionesPushController } from './notificaciones-push.controller';
import { NotificacionesPushService } from './notificaciones-push.service';
import { RecordatoriosScheduler } from './recordatorios.scheduler';

@Module({
  controllers: [NotificacionesPushController],
  providers: [NotificacionesPushService, RecordatoriosScheduler],
})
export class NotificacionesPushModule {}
