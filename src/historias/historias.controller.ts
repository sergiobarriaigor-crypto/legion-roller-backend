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
import { HistoriasService } from './historias.service';
import { CrearHistoriaDto } from './dto/crear-historia.dto';
import { ResponderMencionDto } from './dto/responder-mencion.dto';

interface RequestConUsuario {
  user: { id: number; rol: string; nombre: string };
}

@Controller('historias')
export class HistoriasController {
  constructor(private historiasService: HistoriasService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listar(@Req() req: RequestConUsuario) {
    return this.historiasService.listarAgrupadas(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearHistoriaDto) {
    return this.historiasService.crear(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/vista')
  marcarVista(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.historiasService.marcarVista(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  eliminar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.historiasService.eliminar(id, req.user.id, req.user.rol);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reaccion')
  toggleReaccion(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.historiasService.toggleReaccion(
      id,
      req.user.id,
      req.user.nombre,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/reacciones')
  reacciones(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.historiasService.reaccionesDe(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/mencion')
  responderMencion(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResponderMencionDto,
  ) {
    return this.historiasService.responderMencion(id, req.user.id, dto.aceptar);
  }
}
