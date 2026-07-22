import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClimaService } from './clima.service';

@UseGuards(JwtAuthGuard)
@Controller('clima')
export class ClimaController {
  constructor(private climaService: ClimaService) {}

  @Get()
  obtener() {
    return this.climaService.obtenerTodas();
  }
}
