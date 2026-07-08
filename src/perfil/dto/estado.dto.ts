import { IsString, MaxLength } from 'class-validator';

export class EstadoDto {
  @IsString()
  @MaxLength(50)
  texto: string;
}
