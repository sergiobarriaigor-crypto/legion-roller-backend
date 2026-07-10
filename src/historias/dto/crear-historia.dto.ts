import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CrearHistoriaDto {
  @IsIn(['foto', 'video'])
  tipo: 'foto' | 'video';

  @IsUrl({ require_tld: false })
  mediaUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  texto?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;
}
