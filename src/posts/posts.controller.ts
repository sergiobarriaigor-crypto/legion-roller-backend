import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post as HttpPost,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostsService } from './posts.service';
import { CrearPostDto } from './dto/crear-post.dto';
import { ActualizarPostDto } from './dto/actualizar-post.dto';
import { ComentarioDto } from './dto/comentario.dto';
import { CompartirDto } from './dto/compartir.dto';

interface RequestConUsuario {
  user: { id: number; rol: string };
}

@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get()
  listar(@Query('autorId') autorId?: string) {
    return this.postsService.listar(autorId ? Number(autorId) : undefined);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mis-reacciones')
  misReacciones(@Req() req: RequestConUsuario) {
    return this.postsService.misReacciones(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost()
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearPostDto) {
    return this.postsService.crear(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  actualizar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPostDto,
  ) {
    return this.postsService.actualizar(id, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  eliminar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.eliminar(id, req.user.id, req.user.rol);
  }

  // Rutas literales "notificaciones/..." registradas ANTES de las rutas con
  // ":id" — de otro modo, ":id/reacciones" capturaría por error una request a
  // "notificaciones/reacciones" (mismo profundidad de path, mismo criterio
  // que ya usa historias.controller.ts).
  @UseGuards(JwtAuthGuard)
  @Get('notificaciones/respuestas')
  respuestasSinLeer(@Req() req: RequestConUsuario) {
    return this.postsService.respuestasSinLeer(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('notificaciones/reacciones')
  reaccionesSinLeerAgrupadas(@Req() req: RequestConUsuario) {
    return this.postsService.reaccionesSinLeerAgrupadas(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('notificaciones/respuestas/:comentarioId/leida')
  marcarRespuestaLeida(
    @Req() req: RequestConUsuario,
    @Param('comentarioId', ParseIntPipe) comentarioId: number,
  ) {
    return this.postsService.marcarRespuestaLeida(comentarioId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost('comentarios/:comentarioId/reaccion')
  toggleReaccionComentario(
    @Req() req: RequestConUsuario,
    @Param('comentarioId', ParseIntPipe) comentarioId: number,
  ) {
    return this.postsService.toggleReaccionComentario(
      comentarioId,
      req.user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/reaccion')
  toggleReaccion(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.toggleReaccion(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/reacciones')
  reaccionesDe(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.reaccionesDe(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/comentarios')
  agregarComentario(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ComentarioDto,
  ) {
    return this.postsService.agregarComentario(
      id,
      req.user.id,
      dto.texto,
      dto.respuestaAId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/comentarios')
  comentariosDe(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.comentariosDe(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/comentarios/:comentarioId')
  eliminarComentario(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Param('comentarioId', ParseIntPipe) comentarioId: number,
  ) {
    return this.postsService.eliminarComentario(
      id,
      comentarioId,
      req.user.id,
      req.user.rol,
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/compartir')
  compartir(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompartirDto,
  ) {
    return this.postsService.compartir(id, req.user.id, dto.destinatarioIds);
  }
}
