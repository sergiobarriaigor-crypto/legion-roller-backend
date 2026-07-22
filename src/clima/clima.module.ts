import { Module } from '@nestjs/common';
import { ClimaController } from './clima.controller';
import { ClimaService } from './clima.service';
import { ClimaScheduler } from './clima.scheduler';

@Module({
  controllers: [ClimaController],
  providers: [ClimaService, ClimaScheduler],
})
export class ClimaModule {}
