import { IsOptional, IsString, IsUrl } from 'class-validator';

export class ActualizarPostDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  resena?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsUrl()
  fotoUrl?: string;
}
