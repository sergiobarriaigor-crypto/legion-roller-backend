import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TIPOS_PUBLICACION } from './crear-publicacion.dto';

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
