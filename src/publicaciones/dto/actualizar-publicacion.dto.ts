import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import {
  TIPOS_PUBLICACION,
  TIPOS_FINALIZACION,
  TIPOS_ASISTENCIA_EVENTO,
} from './crear-publicacion.dto';

export class ActualizarPublicacionDto {
  @IsOptional()
  @IsIn(TIPOS_PUBLICACION)
  tipo?: string;

  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  texto?: string;

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsString()
  hora?: string;

  @IsOptional()
  @IsString()
  puntoEncuentro?: string;

  @IsOptional()
  @IsNumber()
  puntoLat?: number;

  @IsOptional()
  @IsNumber()
  puntoLon?: number;

  @IsOptional()
  @IsIn(TIPOS_FINALIZACION)
  tipoFinalizacion?: string;

  @IsOptional()
  @IsNumber()
  puntoFinLat?: number;

  @IsOptional()
  @IsNumber()
  puntoFinLon?: number;

  @IsOptional()
  @IsNumber()
  distanciaMinimaKm?: number;

  @IsOptional()
  @IsBoolean()
  cerrada?: boolean;

  @IsOptional()
  @IsIn(TIPOS_ASISTENCIA_EVENTO)
  tipoAsistenciaEvento?: string;

  @IsOptional()
  @IsString()
  codigoAsistencia?: string;

  @IsOptional()
  @IsBoolean()
  rsvp?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracionHoras?: number;

  @IsOptional()
  @IsBoolean()
  activaEnMapa?: boolean;

  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  fotos?: string[];
}
