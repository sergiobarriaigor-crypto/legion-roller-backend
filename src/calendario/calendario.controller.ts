import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarioService } from './calendario.service';
import { CrearActividadDto } from './dto/crear-actividad.dto';
import { ResponderInvitacionDto } from './dto/responder-invitacion.dto';

interface RequestConUsuario {
  user: { id: number };
}

@Controller('calendario')
export class CalendarioController {
  constructor(private calendarioService: CalendarioService) {}

  @UseGuards(JwtAuthGuard)
  @Get('mes')
  listarMes(
    @Req() req: RequestConUsuario,
    @Query('anio', ParseIntPipe) anio: number,
    @Query('mes', ParseIntPipe) mes: number,
  ) {
    return this.calendarioService.listarMes(req.user.id, anio, mes);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pendientes')
  misInvitacionesPendientes(@Req() req: RequestConUsuario) {
    return this.calendarioService.misInvitacionesPendientes(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('actividades')
  crearActividad(
    @Req() req: RequestConUsuario,
    @Body() dto: CrearActividadDto,
  ) {
    return this.calendarioService.crearActividad(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('actividades/:id/invitacion')
  responderInvitacion(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResponderInvitacionDto,
  ) {
    return this.calendarioService.responderInvitacion(
      req.user.id,
      id,
      dto.estado,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('actividades/:id/cancelar')
  cancelarActividad(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.calendarioService.cancelarActividad(req.user.id, id);
  }
}
