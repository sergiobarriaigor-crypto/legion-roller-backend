import { IsIn, IsNumber, IsOptional } from 'class-validator';

export const MOTIVOS_EMERGENCIA = [
  'caida',
  'salud',
  'seguridad',
  'otro',
] as const;

export class CrearEmergenciaDto {
  @IsIn(MOTIVOS_EMERGENCIA)
  motivo: string;

  // Ubicación en el momento de activar el SOS -- opcional porque el GPS
  // puede fallar/denegarse, en cuyo caso el servicio cae de vuelta a
  // UbicacionActiva (ver EmergenciasService.activas()).
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lon?: number;
}
