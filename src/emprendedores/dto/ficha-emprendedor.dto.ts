import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class FichaEmprendedorDto {
  @IsString()
  nombreNegocio: string;

  @IsString()
  rubro: string;

  @IsString()
  descripcion: string;

  @IsString()
  contacto: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  fotos?: string[];
}
