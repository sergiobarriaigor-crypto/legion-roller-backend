import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EmergenciasController } from './emergencias.controller';
import { EmergenciasService } from './emergencias.service';
import { EmergenciasGateway } from './emergencias.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
    }),
  ],
  controllers: [EmergenciasController],
  providers: [EmergenciasService, EmergenciasGateway],
})
export class EmergenciasModule {}
