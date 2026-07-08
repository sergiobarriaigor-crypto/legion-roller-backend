import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmergenciasService } from './emergencias.service';
import { CrearEmergenciaDto } from './dto/crear-emergencia.dto';

interface RequestConUsuario {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('emergencias')
export class EmergenciasController {
  constructor(private emergenciasService: EmergenciasService) {}

  @Post()
  activar(@Req() req: RequestConUsuario, @Body() dto: CrearEmergenciaDto) {
    return this.emergenciasService.activar(req.user.id, dto.motivo);
  }

  @Delete('mia')
  cancelar(@Req() req: RequestConUsuario) {
    return this.emergenciasService.cancelar(req.user.id);
  }

  @Get('mia')
  miEmergencia(@Req() req: RequestConUsuario) {
    return this.emergenciasService.miEmergencia(req.user.id);
  }

  @Get('activas')
  activas() {
    return this.emergenciasService.activas();
  }
}
