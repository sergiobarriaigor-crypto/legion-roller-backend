import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MapaController } from './mapa.controller';
import { MapaService } from './mapa.service';
import { MapaGateway } from './mapa.gateway';
import { MapaInactividadScheduler } from './mapa-inactividad.scheduler';
import { NotificacionesPushModule } from '../notificaciones-push/notificaciones-push.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
    }),
    NotificacionesPushModule,
  ],
  controllers: [MapaController],
  providers: [MapaService, MapaGateway, MapaInactividadScheduler],
})
export class MapaModule {}
