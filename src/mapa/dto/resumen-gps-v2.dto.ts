import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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

// FASE DIAGNÓSTICA ENERGÍA (ver DiagnosticoHeartbeat.java) -- a diferencia de
// HuecoHeartbeatV2Dto (solo huecos anómalos), se registra en CADA tick
// normal del heartbeat. Ninguno de estos campos participa en ningún
// criterio de V1/V2.
export class SnapshotEnergiaV2Dto {
  @IsNumber()
  timestamp: number;

  @IsBoolean()
  isInteractive: boolean;

  @IsBoolean()
  isDeviceIdleMode: boolean;

  @IsBoolean()
  isPowerSaveMode: boolean;

  @IsBoolean()
  isIgnoringBatteryOptimizations: boolean;

  @IsInt()
  memoryImportance: number;
}

// Un renglón por CAMBIO de valor (screen/doze/powerSave/batteryExemption)
// respecto del tick anterior -- nunca uno por tick.
export class TransicionEnergiaV2Dto {
  @IsIn(['screen', 'doze', 'powerSave', 'batteryExemption'])
  tipo: string;

  @IsBoolean()
  anterior: boolean;

  @IsBoolean()
  nuevo: boolean;

  @IsNumber()
  timestamp: number;
}

// FASE DIAGNÓSTICA "TRES RELOJES" (ver DiagnosticoHeartbeat.java). Todo
// OPCIONAL y aditivo: un cliente anterior que no manda nada de esto sigue
// validando igual. Si viene, se valida (IsOptional solo exime la ausencia).
// Los ArrayMaxSize acotan el tamaño: el cuerpo de este endpoint tiene un
// límite (ver configurar-body-parsers.ts).
//
// Interpretación (no atribuye la causa a ningún fabricante): el cociente
// du/de de un corte mide actividad GLOBAL de CPU -- ~1 = CPU despierta
// durante el corte, ~0 = CPU suspendida.
export class UltimoTickRelojesV2Dto {
  @IsInt()
  @Min(0)
  i: number;

  @IsNumber() w: number;
  @IsNumber() u: number;
  @IsNumber() e: number;
  @IsNumber() fl: number;
  @IsNumber() imp: number;
}

// Serie continua en columnas con deltas respecto de la muestra anterior
// (dw/du/de tienen n-1 elementos; fl/imp tienen n).
export class RelojesHeartbeatV2Dto {
  @IsInt()
  @Min(1)
  paso: number;

  @IsInt()
  @Min(0)
  n: number;

  @IsOptional() @IsNumber() w0?: number;
  @IsOptional() @IsNumber() u0?: number;
  @IsOptional() @IsNumber() e0?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsNumber({}, { each: true })
  dw?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsNumber({}, { each: true })
  du?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsNumber({}, { each: true })
  de?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsNumber({}, { each: true })
  fl?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsNumber({}, { each: true })
  imp?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UltimoTickRelojesV2Dto)
  ultimo?: UltimoTickRelojesV2Dto;
}

export class CorteHeartbeatV2Dto {
  @IsInt()
  @Min(0)
  i: number;

  @IsNumber() pw: number;
  @IsNumber() pu: number;
  @IsNumber() pe: number;
  @IsNumber() w: number;
  @IsNumber() u: number;
  @IsNumber() e: number;
  @IsNumber() dw: number;
  @IsNumber() du: number;
  @IsNumber() de: number;
  @IsNumber() r: number;
  @IsNumber() f0: number;
  @IsNumber() f1: number;
  @IsNumber() imp: number;
  @IsNumber() bk: number;
  @IsNumber() th: number;
  @IsNumber() pc: number;
  @IsNumber() tp: number;

  @IsString()
  hilo: string;
}

export class MuestraLentaV2Dto {
  @IsNumber() w: number;
  @IsNumber() e: number;
  @IsNumber() bk: number;
  @IsNumber() th: number;
  @IsNumber() pc: number;
  @IsNumber() tp: number;
}

export class FallosHeartbeatV2Dto {
  @IsInt() @Min(0) general: number;
  @IsInt() @Min(0) luz: number;
  @IsInt() @Min(0) wakelock: number;
  @IsInt() @Min(0) bgr: number;
  @IsInt() @Min(0) bucket: number;
  @IsInt() @Min(0) termica: number;
  @IsInt() @Min(0) bateria: number;
}

export class ContadoresHeartbeatV2Dto {
  @IsInt() @Min(0) version: number;
  @IsInt() sdk: number;
  @IsNumber() umbralCorteMs: number;
  @IsInt() @Min(1) paso: number;
  @IsInt() @Min(0) decimaciones: number;
  @IsInt() @Min(0) cortesDescartados: number;
  @IsInt() @Min(0) costoTickN: number;
  @IsNumber() costoTickMedioUs: number;
  @IsNumber() costoTickMaxUs: number;

  @ValidateNested()
  @Type(() => FallosHeartbeatV2Dto)
  fallos: FallosHeartbeatV2Dto;
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

  // FASE DIAGNÓSTICA ENERGÍA -- ver SnapshotEnergiaV2Dto/TransicionEnergiaV2Dto
  // arriba. @IsOptional() para que clientes anteriores a esta fase (que no
  // mandan estos 2 campos) sigan validando -- si vienen presentes, siguen
  // validándose igual que cualquier otro campo (IsOptional solo exime la
  // ausencia, no el contenido).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SnapshotEnergiaV2Dto)
  snapshotsEnergia?: SnapshotEnergiaV2Dto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransicionEnergiaV2Dto)
  transicionesEnergia?: TransicionEnergiaV2Dto[];

  // FASE DIAGNÓSTICA "TRES RELOJES" -- ver clases de arriba.
  @IsOptional()
  @ValidateNested()
  @Type(() => RelojesHeartbeatV2Dto)
  relojesHeartbeat?: RelojesHeartbeatV2Dto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CorteHeartbeatV2Dto)
  cortesHeartbeat?: CorteHeartbeatV2Dto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => MuestraLentaV2Dto)
  muestrasLentas?: MuestraLentaV2Dto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ContadoresHeartbeatV2Dto)
  contadoresHeartbeat?: ContadoresHeartbeatV2Dto;

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
