import { IsString, MinLength } from 'class-validator';

export class AnuncioDto {
  @IsString()
  @MinLength(1)
  texto: string;
}
