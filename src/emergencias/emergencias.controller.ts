import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
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
    return this.emergenciasService.activar(
      req.user.id,
      dto.motivo,
      dto.lat,
      dto.lon,
    );
  }

  @Delete('mia')
  cancelar(@Req() req: RequestConUsuario) {
    return this.emergenciasService.cancelar(req.user.id);
  }

  // Para el caso "el accidentado se olvida de cancelar": un Admin puede
  // apagar el SOS de cualquiera en cualquier momento (aparte del vencimiento
  // automático a los 40 min, ver emergencia-vencimiento.scheduler.ts).
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':miembroId/admin')
  cancelarAdmin(@Param('miembroId', ParseIntPipe) miembroId: number) {
    return this.emergenciasService.cancelar(miembroId);
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
