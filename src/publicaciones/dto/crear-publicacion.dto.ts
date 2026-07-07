import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
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
  @IsBoolean()
  rsvp?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracionHoras?: number;

  @IsOptional()
  @IsBoolean()
  activaEnMapa?: boolean;
}
