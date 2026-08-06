import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MapaController } from './mapa.controller';
import { MapaService } from './mapa.service';
import { MapaGateway } from './mapa.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
    }),
  ],
  controllers: [MapaController],
  providers: [MapaService, MapaGateway],
})
export class MapaModule {}
