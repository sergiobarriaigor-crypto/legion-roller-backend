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

export const TIPOS_PUBLICACION = [
  'comunicado',
  'rodada',
  'evento',
  'resumen',
  'alerta',
  'estado_rutas',
  'anuncio',
  'consejo',
] as const;

export const TIPOS_FINALIZACION = [
  'punto_llegada',
  'distancia_minima',
  'ida_vuelta',
  'cierre_manual',
] as const;

export const TIPOS_ASISTENCIA_EVENTO = [
  'gps_puntual',
  'codigo',
  'cierre_manual',
  'autoconfirmacion',
] as const;

export class CrearPublicacionDto {
  @IsIn(TIPOS_PUBLICACION)
  tipo: string;

  @IsString()
  titulo: string;

  @IsString()
  texto: string;

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
