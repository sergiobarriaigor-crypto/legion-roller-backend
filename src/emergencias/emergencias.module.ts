import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmergenciasController } from './emergencias.controller';
import { EmergenciasService } from './emergencias.service';
import { EmergenciasGateway } from './emergencias.gateway';
import { EmergenciaVencimientoScheduler } from './emergencia-vencimiento.scheduler';
import { NotificacionesPushModule } from '../notificaciones-push/notificaciones-push.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
    }),
    NotificacionesPushModule,
  ],
  controllers: [EmergenciasController],
  providers: [
    EmergenciasService,
    EmergenciasGateway,
    EmergenciaVencimientoScheduler,
  ],
})
export class EmergenciasModule {}
