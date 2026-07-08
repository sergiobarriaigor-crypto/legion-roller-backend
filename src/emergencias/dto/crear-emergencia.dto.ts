import { IsIn } from 'class-validator';

export const MOTIVOS_EMERGENCIA = ['caida', 'salud', 'seguridad', 'otro'] as const;

export class CrearEmergenciaDto {
  @IsIn(MOTIVOS_EMERGENCIA)
  motivo: string;
}
