import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostsLimpiezaScheduler } from './posts-limpieza.scheduler';

@Module({
  imports: [ChatModule],
  controllers: [PostsController],
  providers: [PostsService, PostsLimpiezaScheduler],
})
export class PostsModule {}
