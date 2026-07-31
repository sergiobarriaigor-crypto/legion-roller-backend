import { Module } from '@nestjs/common';
import { ClimaController } from './clima.controller';
import { ClimaService } from './clima.service';

@Module({
  controllers: [ClimaController],
  providers: [ClimaService],
})
export class ClimaModule {}
