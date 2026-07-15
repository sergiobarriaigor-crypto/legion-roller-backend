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

  // Para la campana del header: respuestas a mis comentarios sin leer.
  @UseGuards(JwtAuthGuard)
  @Get('notificaciones/respuestas')
  respuestasSinLeer(@Req() req: RequestConUsuario) {
    return this.historiasService.respuestasSinLeer(req.user.id);
  }

  // Para la campana del header: reacciones sin leer en mis historias,
  // agrupadas por historia (evita una fila por cada persona que reaccionó).
  @UseGuards(JwtAuthGuard)
  @Get('notificaciones/reacciones')
  reaccionesSinLeer(@Req() req: RequestConUsuario) {
    return this.historiasService.reaccionesSinLeerAgrupadas(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('notificaciones/respuestas/:comentarioId/leida')
  marcarRespuestaLeida(
    @Req() req: RequestConUsuario,
    @Param('comentarioId', ParseIntPipe) comentarioId: number,
  ) {
    return this.historiasService.marcarRespuestaLeida(
      comentarioId,
      req.user.id,
    );
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
  @Get(':id/comentarios')
  comentarios(@Param('id', ParseIntPipe) id: number) {
    return this.historiasService.comentariosDe(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/comentarios/:comentarioId')
  eliminarComentario(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Param('comentarioId', ParseIntPipe) comentarioId: number,
  ) {
    return this.historiasService.eliminarComentario(
      id,
      comentarioId,
      req.user.id,
      req.user.rol,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/ecos/:ecoId')
  eliminarEco(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Param('ecoId', ParseIntPipe) ecoId: number,
  ) {
    return this.historiasService.eliminarEco(
      id,
      ecoId,
      req.user.id,
      req.user.rol,
    );
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
