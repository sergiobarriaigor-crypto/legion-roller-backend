import { IsString, MinLength } from 'class-validator';

export class ComentarioDto {
  @IsString()
  @MinLength(1)
  texto: string;
}
