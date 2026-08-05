import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  CATEGORIAS_ACTIVIDAD,
  MINUTOS_AVISO_CREADOR_VALIDOS,
} from './crear-actividad.dto';

// Edición de una ActividadCalendario ya creada — todos los campos son
// opcionales porque el formulario reenvía solo lo que el usuario cambió
// (a diferencia de CrearActividadDto, donde título/fecha son obligatorios).
export class ActualizarActividadDto {
  @IsOptional()
  @IsIn(CATEGORIAS_ACTIVIDAD)
  categoria?: string;

  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

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
  @IsString()
  fotoUrl?: string;

  @IsOptional()
  @IsString()
  musicaId?: string;

  @IsOptional()
  @IsIn(MINUTOS_AVISO_CREADOR_VALIDOS)
  minutosAvisoCreador?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  invitadosIds?: number[];
}
