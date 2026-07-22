import { ArrayMaxSize, ArrayMinSize, IsInt } from 'class-validator';

export class ReenviarDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  destinatarioIds: number[];
}
