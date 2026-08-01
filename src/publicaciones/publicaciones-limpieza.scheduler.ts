import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PublicacionesService } from './publicaciones.service';

// Borra en forma real (no solo el filtro de vigencia que ya aplica listar())
// las publicaciones con duracionHoras configurada que ya vencieron — las que
// no tienen duracionHoras son permanentes y no las toca. Mismo patrón de
// cron ya usado por ChatLimpiezaScheduler/HistoriasLimpiezaScheduler/
// PostsLimpiezaScheduler.
@Injectable()
export class PublicacionesLimpiezaScheduler {
  private readonly logger = new Logger(PublicacionesLimpiezaScheduler.name);

  constructor(private publicacionesService: PublicacionesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgarPublicacionesVencidas() {
    const cantidad =
      await this.publicacionesService.purgarPublicacionesVencidas();
    if (cantidad > 0) {
      this.logger.log(`Publicaciones vencidas borradas: ${cantidad}`);
    }
  }
}
