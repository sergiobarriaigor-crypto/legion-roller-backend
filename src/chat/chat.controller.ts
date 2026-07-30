import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { MensajeDto } from './dto/mensaje.dto';
import { ReaccionDto } from './dto/reaccion.dto';
import { ReenviarDto } from './dto/reenviar.dto';

interface RequestConUsuario {
  user: { id: number; rol: string };
}

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversaciones')
  conversaciones(@Req() req: RequestConUsuario) {
    return this.chatService.conversaciones(req.user.id);
  }

  @Get('estado/:miembroId')
  estado(@Param('miembroId', ParseIntPipe) miembroId: number) {
    return this.chatService.estadoDeMiembro(miembroId);
  }

  @Get('mensajes/:sala')
  mensajes(@Req() req: RequestConUsuario, @Param('sala') sala: string) {
    return this.chatService.mensajes(sala, req.user.id);
  }

  // Álbum: adjuntos ya enviados en la sala, agrupados por tipo.
  @Get('mensajes/:sala/adjuntos')
  adjuntos(
    @Req() req: RequestConUsuario,
    @Param('sala') sala: string,
    @Query('tipo') tipo: string,
  ) {
    if (tipo !== 'foto' && tipo !== 'video' && tipo !== 'archivo') {
      throw new BadRequestException('tipo debe ser foto, video o archivo');
    }
    return this.chatService.adjuntosDeSala(sala, req.user.id, tipo);
  }

  @Get('lectura/:sala')
  lectura(@Req() req: RequestConUsuario, @Param('sala') sala: string) {
    return this.chatService.lecturaDeSala(sala, req.user.id);
  }

  @Post('mensajes/:sala')
  enviarMensaje(
    @Req() req: RequestConUsuario,
    @Param('sala') sala: string,
    @Body() dto: MensajeDto,
  ) {
    return this.chatService.enviarMensaje(sala, req.user.id, dto);
  }

  @Post('mensajes/:sala/marcar-leido')
  marcarLeido(@Req() req: RequestConUsuario, @Param('sala') sala: string) {
    return this.chatService.marcarLeido(sala, req.user.id);
  }

  @Delete('mensajes/:id')
  eliminarMensaje(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Query('modo') modo: 'todos' | 'mi' = 'mi',
  ) {
    return this.chatService.eliminarMensaje(
      id,
      req.user.id,
      modo === 'todos' ? 'todos' : 'mi',
      req.user.rol === 'admin',
    );
  }

  @Get('mensajes/:sala/fijados')
  mensajesFijados(@Req() req: RequestConUsuario, @Param('sala') sala: string) {
    return this.chatService.mensajesFijados(sala, req.user.id);
  }

  @Post('mensajes/:id/fijar')
  fijar(@Req() req: RequestConUsuario, @Param('id', ParseIntPipe) id: number) {
    return this.chatService.fijarMensaje(
      id,
      req.user.id,
      req.user.rol === 'admin',
    );
  }

  @Post('mensajes/:id/reaccion')
  reaccionar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReaccionDto,
  ) {
    return this.chatService.reaccionar(id, req.user.id, dto.emoji);
  }

  @Post('mensajes/:id/reenviar')
  reenviar(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReenviarDto,
  ) {
    return this.chatService.reenviarMensaje(
      id,
      req.user.id,
      dto.destinatarioIds,
    );
  }

  @Get('miembros')
  miembros() {
    return this.chatService.miembros();
  }

  // Para la campana del header: publicaciones o fichas de emprendedor que me
  // compartieron y todavía no vi (mensajes de chat con referenciaTipo='post'
  // o 'emprendedor' sin leer).
  @Get('notificaciones/compartidos')
  compartidosSinLeer(@Req() req: RequestConUsuario) {
    return this.chatService.compartidosSinLeer(req.user.id);
  }
}
