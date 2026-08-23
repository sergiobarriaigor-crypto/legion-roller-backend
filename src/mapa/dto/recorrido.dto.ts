import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
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

// DIAGNÓSTICO TEMPORAL (auditoría GPS V2) -- un fix crudo tal como lo vio
// grabacionGps.ts, con el resultado de su propio espejo de solo lectura
// (entroAPuntos/motivoRechazo, ver registrarDiagnosticoGps ahí). No es la
// fuente oficial de qué quedó grabado -- eso sigue siendo únicamente
// `puntos` -- es diagnóstico derivado para poder auditar la captura después.
// BORRAR esta clase (y el campo que la usa en RecorridoDto) una vez cerrada
// la investigación GPS.
export class FixDiagnosticoDto {
  @IsInt()
  indice: number;

  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;

  @IsNumber()
  accuracy: number;

  @IsOptional()
  @IsNumber()
  fixTime: number | null;

  @IsNumber()
  horaRecepcion: number;

  @IsOptional()
  @IsNumber()
  retrasoMs: number | null;

  @IsOptional()
  @IsNumber()
  speed: number | null;

  @IsOptional()
  @IsBoolean()
  simulated: boolean | null;

  @IsOptional()
  @IsNumber()
  dtRealSeg: number | null;

  @IsArray()
  @IsString({ each: true })
  etiquetas: string[];

  @IsBoolean()
  entroAPuntos: boolean;

  @IsOptional()
  @IsString()
  motivoRechazo: string | null;
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

  // "Patinar sin mapear": el GPS se sigue grabando igual (ver
  // mapa.service.ts guardarRecorrido/cumpleReglasAsistencia), pero si es
  // false el frontend nunca debe dibujar/mostrar el trazado — ver
  // misRecorridos() en mapa.service.ts.
  @IsBoolean()
  mapeado: boolean;

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

  // DIAGNÓSTICO TEMPORAL -- ver comentario en FixDiagnosticoDto. Opcional:
  // ausente/vacío en cualquier grabación sin el diagnóstico activo, sin
  // afectar el resto del guardado (ver guardarRecorrido en mapa.service.ts).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FixDiagnosticoDto)
  diagnosticoGps?: FixDiagnosticoDto[];
}
