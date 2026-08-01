import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostsService } from './posts.service';

// Borra en forma real (no solo el filtro de vigencia que ya aplica listar())
// los posts que superaron los 7 días — mismo patrón de cron ya usado por
// ChatLimpiezaScheduler/HistoriasLimpiezaScheduler.
@Injectable()
export class PostsLimpiezaScheduler {
  private readonly logger = new Logger(PostsLimpiezaScheduler.name);

  constructor(private postsService: PostsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgarPostsVencidos() {
    const cantidad = await this.postsService.purgarPostsVencidos();
    if (cantidad > 0) {
      this.logger.log(`Posts vencidos borrados: ${cantidad}`);
    }
  }
}
