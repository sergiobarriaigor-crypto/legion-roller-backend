import { Module } from '@nestjs/common';
import { CalendarioController } from './calendario.controller';
import { CalendarioService } from './calendario.service';
import { CalendarioRecordatoriosScheduler } from './calendario-recordatorios.scheduler';
import { CalendarioLimpiezaScheduler } from './calendario-limpieza.scheduler';
import { NotificacionesPushModule } from '../notificaciones-push/notificaciones-push.module';

@Module({
  imports: [NotificacionesPushModule],
  controllers: [CalendarioController],
  providers: [
    CalendarioService,
    CalendarioRecordatoriosScheduler,
    CalendarioLimpiezaScheduler,
  ],
})
export class CalendarioModule {}
