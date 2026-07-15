import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class ResenaDto {
  @IsString()
  @MinLength(1)
  texto: string;

  @IsOptional()
  @IsInt()
  respuestaAId?: number;
}
