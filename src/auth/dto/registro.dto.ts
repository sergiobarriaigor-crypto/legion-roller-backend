import { IsOptional, IsString, MinLength } from 'class-validator';

export class RegistroDto {
  @IsString()
  nombre: string;

  @IsString()
  telefono: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsString()
  @MinLength(4)
  clave: string;
}
