import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Mención de un integrante sobre la imagen (pegatina "@nombre" arrastrable y
// pellizcable), igual dinámica que el texto pero sin rotación.
export class MencionInputDto {
  @IsInt()
  miembroId: number;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsOptional()
  @IsNumber()
  escala?: number;
}

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

  // Hasta MAX_MENCIONES_POR_HISTORIA (5, validado también en el servicio).
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MencionInputDto)
  @ArrayMaxSize(5)
  menciones?: MencionInputDto[];
}
