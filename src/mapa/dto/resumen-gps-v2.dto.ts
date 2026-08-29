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

// GPS V2 (Fase 2, modo sombra) -- resumen mínimo de comparación V1 vs V2,
// enviado en un POST separado y posterior al guardado real de la ruta (ver
// finalizarModo en MapaView.tsx y obtenerResumenGpsV2 en gpsV2/index.ts).
// Deliberadamente no es un log por-fix (ver el 413 "request entity too
// large" que motivó este diseño): puntosConfiables es del mismo orden que
// `puntos` de V1 (ya seguro), todo lo demás son conteos o listas que solo
// crecen con eventos poco frecuentes.

export class PuntoV2Dto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;

  @IsNumber()
  timestamp: number;
}

export class DiscontinuidadV2Dto {
  @IsInt()
  antesIndice: number;

  @IsInt()
  despuesIndice: number;

  @IsIn(['hueco', 'cambio-trayectoria'])
  motivo: string;
}

export class EntradaRecuperacionV2Dto {
  @IsInt()
  indiceFix: number;

  @IsOptional()
  @IsNumber()
  fixTime: number | null;
}

export class RechazadoV2Dto {
  @IsString()
  motivo: string;

  @IsInt()
  @Min(0)
  cantidad: number;
}

export class EventoDisponibilidadV2Dto {
  @IsBoolean()
  disponible: boolean;

  @IsNumber()
  hora: number;
}

export class ResumenGpsV2Dto {
  @IsInt()
  @Min(0)
  fixesRecibidos: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuntoV2Dto)
  puntosConfiables: PuntoV2Dto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscontinuidadV2Dto)
  discontinuidades: DiscontinuidadV2Dto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntradaRecuperacionV2Dto)
  entradasRecuperacion: EntradaRecuperacionV2Dto[];

  @IsInt()
  @Min(0)
  candidatosPendientes: number;

  // Ver gpsV2/index.ts -- resultados "candidato-recuperacion", necesario
  // para que el invariante de auditoría (fixesRecibidos = suma de todos los
  // conteos) cierre en cualquier instante, no solo al finalizar.
  @IsInt()
  @Min(0)
  candidatosRecuperacion: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RechazadoV2Dto)
  rechazados: RechazadoV2Dto[];

  // Instrumentación adicional (auditoría ruta 100, ver gpsV2/index.ts) --
  // no cambia ningún criterio del pipeline, solo lo hace visible.
  @IsInt()
  @Min(0)
  ruido: number;

  @IsNumber()
  @Min(0)
  maxIntervaloEntreFixesCrudosSeg: number;

  // Auditoría de disponibilidad de la fuente de ubicación del sistema (ver
  // informarDisponibilidadUbicacionV2 en gpsV2/index.ts).
  @IsInt()
  @Min(0)
  fixesRecibidosFuenteNoDisponible: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventoDisponibilidadV2Dto)
  eventosDisponibilidad: EventoDisponibilidadV2Dto[];
}
