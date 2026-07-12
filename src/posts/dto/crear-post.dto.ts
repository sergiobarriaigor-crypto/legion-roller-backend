import { IsArray, IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

export class CrearPostDto {
  @IsString()
  titulo: string;

  @IsString()
  resena: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsOptional()
  @IsIn(['foto', 'video'])
  tipo?: 'foto' | 'video';

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  fotos?: string[];

  @IsOptional()
  @IsUrl({ require_tld: false })
  videoUrl?: string;
}
