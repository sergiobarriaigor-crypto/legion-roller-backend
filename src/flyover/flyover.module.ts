import { Module } from '@nestjs/common';
import { NotificacionesPushModule } from '../notificaciones-push/notificaciones-push.module';
import { FlyoverController } from './flyover.controller';
import { FlyoverService } from './flyover.service';
import { FlyoverRenderService } from './flyover-render.service';
import { FlyoverLimpiezaScheduler } from './flyover-limpieza.scheduler';

@Module({
  imports: [NotificacionesPushModule],
  controllers: [FlyoverController],
  providers: [FlyoverService, FlyoverRenderService, FlyoverLimpiezaScheduler],
})
export class FlyoverModule {}
