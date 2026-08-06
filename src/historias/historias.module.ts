import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificacionesPushModule } from '../notificaciones-push/notificaciones-push.module';
import { HistoriasController } from './historias.controller';
import { HistoriasService } from './historias.service';
import { HistoriasGateway } from './historias.gateway';
import { HistoriasLimpiezaScheduler } from './historias-limpieza.scheduler';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
    }),
    NotificacionesPushModule,
  ],
  controllers: [HistoriasController],
  providers: [HistoriasService, HistoriasGateway, HistoriasLimpiezaScheduler],
})
export class HistoriasModule {}
