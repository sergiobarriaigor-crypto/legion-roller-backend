import { IsBoolean } from 'class-validator';

export class ResponderMencionDto {
  @IsBoolean()
  aceptar: boolean;
}
