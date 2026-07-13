import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [ChatModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
