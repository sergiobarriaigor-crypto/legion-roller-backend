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

// Instrumentación diagnóstica (auditoría ruta 103, ver
// frontend/src/lib/gpsV2/diagnosticoNativo.ts) -- puramente observacional,
// no participa en ningún criterio de aceptación/rechazo/recuperación de
// V1/V2. Todo opcional: rutas grabadas con un cliente que todavía no manda
// esto siguen validando igual.

export class HuecoNativoV2Dto {
  @IsNumber()
  anteriorTimestamp: number;

  @IsNumber()
  actualTimestamp: number;

  @IsNumber()
  intervaloSeg: number;
}

// providerAvailability (FusedLocationProviderClient.onLocationAvailability())
// -- deliberadamente separado de EventoDisponibilidadV2Dto de arriba
// (systemLocationEnabled, LocationManager.MODE_CHANGED_ACTION): son dos
// señales distintas de Android.
export class EventoDisponibilidadProveedorV2Dto {
  @IsBoolean()
  disponible: boolean;

  @IsNumber()
  horaNativa: number;
}

// Lifecycle de MainActivity (onPause/onResume) -- deliberadamente NO
// "foreground/background de la app", ver comentario en tipos.ts del
// frontend.
export class EventoPauseResumeActivityV2Dto {
  @IsBoolean()
  activo: boolean;

  @IsNumber()
  hora: number;
}

// Instrumentación adicional (auditoría ruta 104 -- investigación de la
// hipótesis "doble watcher"). Puramente observacional, mismo criterio de
// opcionalidad que el resto de este archivo.

export class EventoWatcherV2Dto {
  @IsNumber()
  hora: number;

  @IsInt()
  @Min(0)
  cantidad: number;
}

export class ForegroundErrorV2Dto {
  @IsString()
  mensaje: string;

  @IsNumber()
  hora: number;
}

export class ThreadRequestUpdatesV2Dto {
  @IsString()
  nombreThread: string;

  @IsNumber()
  hora: number;
}

// Lado JS de la misma investigación (ver grabacionGps.ts en el frontend) --
// no viene del plugin nativo, se fusiona en obtenerResumenGpsV2ConDiagnosticoNativo().
export class IntentosIniciarGrabacionV2Dto {
  @IsInt()
  @Min(0)
  entradas: number;

  @IsInt()
  @Min(0)
  pasaronGuard: number;

  @IsInt()
  @Min(0)
  llegaronAWatcher: number;
}

// Heartbeat (auditoría ruta 107, ver DiagnosticoHeartbeat.java) -- entrada
// anómala del heartbeat nativo (intervalo entre ticks de 5s >=20s). Ninguno
// de estos campos participa en ningún criterio de V1/V2.
export class HuecoHeartbeatV2Dto {
  @IsNumber()
  anteriorTimestamp: number;

  @IsNumber()
  actualTimestamp: number;

  @IsNumber()
  intervaloSeg: number;

  @IsBoolean()
  isDeviceIdleMode: boolean;

  @IsBoolean()
  isInteractive: boolean;

  @IsInt()
  memoryImportance: number;

  @IsString()
  nombreThread: string;
}

export class DiagnosticoNativoV2Dto {
  @IsInt()
  @Min(0)
  total: number;

  @IsNumber()
  ultimoTimestamp: number;

  @IsNumber()
  @Min(0)
  maxIntervaloSeg: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HuecoNativoV2Dto)
  huecosNativos: HuecoNativoV2Dto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventoDisponibilidadProveedorV2Dto)
  eventosDisponibilidadProveedor: EventoDisponibilidadProveedorV2Dto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventoPauseResumeActivityV2Dto)
  eventosPauseResumeActivity: EventoPauseResumeActivityV2Dto[];

  // Instrumentación adicional (auditoría ruta 104) -- ver arriba.
  @IsInt()
  @Min(0)
  watchersActivos: number;

  @IsInt()
  @Min(0)
  maxWatchersSimultaneos: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventoWatcherV2Dto)
  eventosWatchers: EventoWatcherV2Dto[];

  @IsInt()
  @Min(0)
  foregroundIntentos: number;

  @IsInt()
  @Min(0)
  foregroundExitos: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ForegroundErrorV2Dto)
  foregroundErrores: ForegroundErrorV2Dto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ThreadRequestUpdatesV2Dto)
  threadsRequestUpdates: ThreadRequestUpdatesV2Dto[];

  // Heartbeat (auditoría ruta 107) -- ver HuecoHeartbeatV2Dto arriba.
  @IsInt()
  @Min(0)
  totalHeartbeats: number;

  @IsNumber()
  ultimoHeartbeatTimestamp: number;

  @IsNumber()
  @Min(0)
  maxIntervaloHeartbeatSeg: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HuecoHeartbeatV2Dto)
  huecosHeartbeat: HuecoHeartbeatV2Dto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => IntentosIniciarGrabacionV2Dto)
  intentosIniciarGrabacion?: IntentosIniciarGrabacionV2Dto;
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

  // Instrumentación diagnóstica (auditoría ruta 103) -- opcional, ver
  // DiagnosticoNativoV2Dto arriba.
  @IsOptional()
  @ValidateNested()
  @Type(() => DiagnosticoNativoV2Dto)
  diagnosticoNativo?: DiagnosticoNativoV2Dto;
}
