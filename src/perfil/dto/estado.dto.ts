import { IsString, MaxLength } from 'class-validator';

export class EstadoDto {
  @IsString()
  @MaxLength(140)
  texto: string;
}
