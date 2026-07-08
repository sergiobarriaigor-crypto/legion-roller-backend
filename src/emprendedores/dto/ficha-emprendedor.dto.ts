import { IsOptional, IsString } from 'class-validator';

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
}
