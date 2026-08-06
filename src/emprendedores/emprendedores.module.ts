import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { NotificacionesPushModule } from '../notificaciones-push/notificaciones-push.module';
import { EmprendedoresController } from './emprendedores.controller';
import { EmprendedoresService } from './emprendedores.service';

@Module({
  imports: [ChatModule, NotificacionesPushModule],
  controllers: [EmprendedoresController],
  providers: [EmprendedoresService],
})
export class EmprendedoresModule {}
