import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class ComentarioDto {
  @IsString()
  @MinLength(1)
  texto: string;

  @IsOptional()
  @IsInt()
  respuestaAId?: number;
}
