import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

// A diferencia de Publicacion (rodada/evento, creados por el Admin, abiertos
// a todo el club vía RSVP), estas tres categorías las puede crear cualquier
// miembro, con una lista de invitados propia — ver ActividadCalendario en
// schema.prisma.
export const CATEGORIAS_ACTIVIDAD = [
  'entrenamiento',
  'reunion',
  'patinada_libre',
] as const;

// Mismas 3 opciones que se le ofrecen al creador para su aviso personal
// (ver calendario-recordatorios.scheduler.ts) — el aviso de 24h a todos los
// invitados es fijo y no se elige acá.
export const MINUTOS_AVISO_CREADOR_VALIDOS = [30, 60, 120] as const;

export class CrearActividadDto {
  @IsIn(CATEGORIAS_ACTIVIDAD)
  categoria: string;

  @IsString()
  titulo: string;

  @IsString()
  fecha: string;

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

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  invitadosIds: number[];
}
