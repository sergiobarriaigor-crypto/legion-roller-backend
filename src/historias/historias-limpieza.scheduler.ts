import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HistoriasService } from './historias.service';

// Borra en forma real (no solo el filtro de vigencia que ya aplica
// listarAgrupadas) las historias que superaron las 24h — mismo patrón de
// cron ya usado por ChatLimpiezaScheduler.
@Injectable()
export class HistoriasLimpiezaScheduler {
  private readonly logger = new Logger(HistoriasLimpiezaScheduler.name);

  constructor(private historiasService: HistoriasService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgarHistoriasVencidas() {
    const cantidad = await this.historiasService.purgarHistoriasVencidas();
    if (cantidad > 0) {
      this.logger.log(`Historias vencidas borradas: ${cantidad}`);
    }
  }
}
