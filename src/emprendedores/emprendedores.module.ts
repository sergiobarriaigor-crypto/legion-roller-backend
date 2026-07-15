import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { EmprendedoresController } from './emprendedores.controller';
import { EmprendedoresService } from './emprendedores.service';

@Module({
  imports: [ChatModule],
  controllers: [EmprendedoresController],
  providers: [EmprendedoresService],
})
export class EmprendedoresModule {}
