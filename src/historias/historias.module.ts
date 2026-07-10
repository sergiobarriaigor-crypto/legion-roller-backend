import { Module } from '@nestjs/common';
import { HistoriasController } from './historias.controller';
import { HistoriasService } from './historias.service';

@Module({
  controllers: [HistoriasController],
  providers: [HistoriasService],
})
export class HistoriasModule {}
