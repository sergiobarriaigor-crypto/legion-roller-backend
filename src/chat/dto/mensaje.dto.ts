import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

const TIPOS_ADJUNTO = ['foto', 'ubicacion', 'ruta'] as const;

export class MensajeDto {
  // Opcional para permitir un adjunto sin texto (ej. una foto sin descripción);
  // se valida en el service que venga al menos texto o un adjunto.
  @IsOptional()
  @IsString()
  texto?: string;

  @IsOptional()
  @IsIn(['post', 'emprendedor', 'historia'])
  referenciaTipo?: string;

  @IsOptional()
  @IsInt()
  referenciaId?: number;

  // Responder (hilo de un solo nivel, validado en ChatService).
  @IsOptional()
  @IsInt()
  respuestaAId?: number;

  @IsOptional()
  @IsIn(TIPOS_ADJUNTO)
  adjuntoTipo?: (typeof TIPOS_ADJUNTO)[number];

  @IsOptional()
  @IsString()
  adjuntoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  adjuntoUbicacionNombre?: string;

  @IsOptional()
  @IsNumber()
  adjuntoUbicacionLat?: number;

  @IsOptional()
  @IsNumber()
  adjuntoUbicacionLon?: number;

  @IsOptional()
  adjuntoRutaDistanciaKm?: number;

  @IsOptional()
  adjuntoRutaDuracionSeg?: number;

  @IsOptional()
  @IsString()
  adjuntoRutaPuntos?: string;
}
