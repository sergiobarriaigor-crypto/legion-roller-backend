import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClimaService } from './clima.service';

// Refresca el caché de clima cada 30 min — mismo patrón de cron ya usado
// por RecordatoriosScheduler / ChatLimpiezaScheduler.
@Injectable()
export class ClimaScheduler {
  constructor(private climaService: ClimaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async refrescarClima() {
    await this.climaService.refrescarTodas();
  }
}
