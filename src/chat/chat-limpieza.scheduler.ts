import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatService } from './chat.service';

// Borra en forma real (no solo oculta) los mensajes de chat que superaron
// los 30 días de vigencia — mismo patrón de cron ya usado por
// RecordatoriosScheduler (notificaciones-push).
@Injectable()
export class ChatLimpiezaScheduler {
  private readonly logger = new Logger(ChatLimpiezaScheduler.name);

  constructor(private chatService: ChatService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgarMensajesVencidos() {
    const cantidad = await this.chatService.purgarMensajesVencidos();
    if (cantidad > 0) {
      this.logger.log(`Mensajes de chat vencidos borrados: ${cantidad}`);
    }
  }
}
