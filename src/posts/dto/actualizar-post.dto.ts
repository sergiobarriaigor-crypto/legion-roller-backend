import { IsArray, IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

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
