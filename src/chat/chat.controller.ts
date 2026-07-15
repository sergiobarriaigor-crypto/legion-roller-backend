import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { MensajeDto } from './dto/mensaje.dto';

interface RequestConUsuario {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversaciones')
  conversaciones(@Req() req: RequestConUsuario) {
    return this.chatService.conversaciones(req.user.id);
  }

  @Get('mensajes/:sala')
  mensajes(@Req() req: RequestConUsuario, @Param('sala') sala: string) {
    return this.chatService.mensajes(sala, req.user.id);
  }

  @Post('mensajes/:sala')
  enviarMensaje(
    @Req() req: RequestConUsuario,
    @Param('sala') sala: string,
    @Body() dto: MensajeDto,
  ) {
    return this.chatService.enviarMensaje(sala, req.user.id, dto);
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
