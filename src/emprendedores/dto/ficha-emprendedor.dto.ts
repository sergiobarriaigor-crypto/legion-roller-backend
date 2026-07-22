import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class FichaEmprendedorDto {
  @IsString()
  nombreNegocio: string;

  @IsString()
  rubro: string;

  @IsString()
  descripcion: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsString()
  instagram: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUrl({ require_tld: false }, { each: true })
  fotos?: string[];
}
