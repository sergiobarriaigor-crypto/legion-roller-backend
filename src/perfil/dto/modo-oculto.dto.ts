import { IsBoolean } from 'class-validator';

export class ModoOcultoDto {
  @IsBoolean()
  activo: boolean;
}
