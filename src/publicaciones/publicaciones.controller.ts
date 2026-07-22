import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PublicacionesService } from './publicaciones.service';
import { CrearPublicacionDto } from './dto/crear-publicacion.dto';
import { ActualizarPublicacionDto } from './dto/actualizar-publicacion.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { ConfirmarAsistenciaEventoDto } from './dto/confirmar-asistencia-evento.dto';

interface RequestConUsuario {
  user: { id: number };
}

@Controller('publicaciones')
export class PublicacionesController {
  constructor(private publicacionesService: PublicacionesService) {}

  @Get()
  listar() {
    return this.publicacionesService.listar();
  }

  @UseGuards(JwtAuthGuard)
  @Get('mis-rsvps')
  misRsvps(@Req() req: RequestConUsuario) {
    return this.publicacionesService.misRsvps(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mis-asistencias-evento')
  misAsistenciasEvento(@Req() req: RequestConUsuario) {
    return this.publicacionesService.misAsistenciasEvento(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  crear(@Body() dto: CrearPublicacionDto) {
    return this.publicacionesService.crear(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPublicacionDto,
  ) {
    return this.publicacionesService.actualizar(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.publicacionesService.eliminar(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id/rsvps')
  detalleRsvps(@Param('id', ParseIntPipe) id: number) {
    return this.publicacionesService.detalleRsvps(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/rsvp')
  marcarRsvp(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RsvpDto,
  ) {
    return this.publicacionesService.marcarRsvp(id, req.user.id, dto.estado);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/confirmar-asistencia')
  confirmarAsistenciaEvento(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmarAsistenciaEventoDto,
  ) {
    return this.publicacionesService.confirmarAsistenciaEvento(
      req.user.id,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id/asistencia-evento')
  listarParaRollCall(@Param('id', ParseIntPipe) id: number) {
    return this.publicacionesService.listarParaRollCall(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/asistencia-evento/:miembroId')
  alternarAsistenciaManual(
    @Param('id', ParseIntPipe) id: number,
    @Param('miembroId', ParseIntPipe) miembroId: number,
  ) {
    return this.publicacionesService.alternarAsistenciaManual(id, miembroId);
  }
}
