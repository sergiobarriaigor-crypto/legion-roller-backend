import { Module } from '@nestjs/common';
import { PublicacionesController } from './publicaciones.controller';
import { PublicacionesService } from './publicaciones.service';
import { PublicacionesLimpiezaScheduler } from './publicaciones-limpieza.scheduler';

@Module({
  controllers: [PublicacionesController],
  providers: [PublicacionesService, PublicacionesLimpiezaScheduler],
})
export class PublicacionesModule {}
