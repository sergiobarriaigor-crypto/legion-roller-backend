import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
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
}
