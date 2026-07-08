import { Module } from '@nestjs/common';
import { EmprendedoresController } from './emprendedores.controller';
import { EmprendedoresService } from './emprendedores.service';

@Module({
  controllers: [EmprendedoresController],
  providers: [EmprendedoresService],
})
export class EmprendedoresModule {}
