import { IsString, MinLength, MaxLength } from 'class-validator';

export class ReconocimientoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  texto: string;
}
