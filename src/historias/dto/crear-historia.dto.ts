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

  // JSON opaco: array de {url,x,y,escala,rotacion} de fotos "Polaroid"
  // pegadas sobre la imagen — mismo criterio que textoEstilo.
  @IsOptional()
  @IsString()
  fotosSticker?: string;

  // Ruta relativa a una pista del catálogo propio de la app (no una URL de
  // /uploads, por eso no usa @IsUrl) — ej. "/musica/fiesta/01-nombre.mp3".
  @IsOptional()
  @IsString()
  musicaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  musicaNombre?: string;

  // Segundo desde el que arranca la pista dentro de la historia (elegido en
  // el editor cuando la canción dura más que la historia) — undefined/0
  // significa desde el principio.
  @IsOptional()
  @IsNumber()
  musicaInicioSeg?: number;

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
