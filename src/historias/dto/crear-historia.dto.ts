import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CrearHistoriaDto {
  @IsIn(['foto', 'video'])
  tipo: 'foto' | 'video';

  @IsUrl({ require_tld: false })
  mediaUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  texto?: string;

  // JSON opaco (posición, escala, rotación, fuente, color, alineación, fondo)
  // armado e interpretado solo por el frontend — el backend no lo valida en
  // detalle, mismo criterio que "puntos" en Recorrido.
  @IsOptional()
  @IsString()
  textoEstilo?: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  // Mención de otro integrante (pegatina "@nombre" arrastrable sobre la imagen).
  @IsOptional()
  @IsInt()
  mencionadoId?: number;

  @IsOptional()
  @IsNumber()
  mencionX?: number;

  @IsOptional()
  @IsNumber()
  mencionY?: number;
}
