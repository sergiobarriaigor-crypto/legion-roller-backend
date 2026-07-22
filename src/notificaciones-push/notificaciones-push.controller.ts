import {
  Body,
  Controller,
  Delete,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificacionesPushService } from './notificaciones-push.service';
import { PushSuscripcionDto } from './dto/push-suscripcion.dto';
import { NotificarmePushDto } from './dto/notificarme-push.dto';

interface RequestConUsuario {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('notificaciones-push')
export class NotificacionesPushController {
  constructor(private notificacionesPushService: NotificacionesPushService) {}

  @Post('suscripcion')
  suscribir(@Req() req: RequestConUsuario, @Body() dto: PushSuscripcionDto) {
    return this.notificacionesPushService.guardarSuscripcion(req.user.id, dto);
  }

  @Delete('suscripcion')
  desuscribir(@Query('endpoint') endpoint: string) {
    return this.notificacionesPushService.eliminarSuscripcion(endpoint);
  }

  // Push a los propios dispositivos suscritos del usuario autenticado — nunca
  // a otro miembroId, para que esto no se pueda usar para molestar a nadie
  // más. Pensado para avisos que deben llegar aunque el celular esté con la
  // pantalla apagada/en el bolsillo (ej. velocidad sospechosa en el mapa).
  @Post('notificarme')
  notificarme(@Req() req: RequestConUsuario, @Body() dto: NotificarmePushDto) {
    return this.notificacionesPushService.enviarAMiembros([req.user.id], dto);
  }
}
