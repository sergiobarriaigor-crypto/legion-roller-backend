import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CrearPostDto {
  @IsString()
  titulo: string;

  @IsString()
  resena: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  fotoUrl?: string;
}
