import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClimaService } from './clima.service';

@UseGuards(JwtAuthGuard)
@Controller('clima')
export class ClimaController {
  constructor(private climaService: ClimaService) {}

  @Get()
  obtener(@Query('lat') lat: string, @Query('lon') lon: string) {
    return this.climaService.obtener(Number(lat), Number(lon));
  }
}
