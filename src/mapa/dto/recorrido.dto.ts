import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class PuntoDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;

  @IsNumber()
  timestamp: number;
}

export class RecorridoDto {
  @IsIn(['ruta', 'libre'])
  tipo: string;

  @IsNumber()
  @Min(0)
  distanciaKm: number;

  @IsNumber()
  @Min(0)
  duracionSeg: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuntoDto)
  puntos: PuntoDto[];

  // Rodada a la que el usuario decidió unirse al detectarla cerca (ver
  // mapa.service.ts rodadasCercanas/guardarRecorrido). Opcional: si no se
  // cumplen las 4 reglas de asistencia, el recorrido se guarda igual, solo
  // que sin AsistenciaRodada asociada.
  @IsOptional()
  @IsInt()
  publicacionId?: number;
}
