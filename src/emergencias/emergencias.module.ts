import { Module } from '@nestjs/common';
import { EmergenciasController } from './emergencias.controller';
import { EmergenciasService } from './emergencias.service';

@Module({
  controllers: [EmergenciasController],
  providers: [EmergenciasService],
})
export class EmergenciasModule {}
