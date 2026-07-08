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
  eliminar(@Req() req: RequestConUsuario, @Param('id', ParseIntPipe) id: number) {
    return this.postsService.eliminar(id, req.user.id, req.user.rol);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/reaccion')
  toggleReaccion(@Req() req: RequestConUsuario, @Param('id', ParseIntPipe) id: number) {
    return this.postsService.toggleReaccion(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/comentarios')
  agregarComentario(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ComentarioDto,
  ) {
    return this.postsService.agregarComentario(id, req.user.id, dto.texto);
  }
}
