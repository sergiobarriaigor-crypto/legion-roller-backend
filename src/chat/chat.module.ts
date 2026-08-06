import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatPresenceService } from './chat-presence.service';
import { ChatLimpiezaScheduler } from './chat-limpieza.scheduler';
import { NotificacionesPushModule } from '../notificaciones-push/notificaciones-push.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
    }),
    NotificacionesPushModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    ChatPresenceService,
    ChatLimpiezaScheduler,
  ],
  exports: [ChatService],
})
export class ChatModule {}
