import { IsIn, IsOptional } from 'class-validator';

export const ESTILOS_FLYOVER = ['edificios', 'satelital'] as const;
export type EstiloFlyover = (typeof ESTILOS_FLYOVER)[number];

export class SolicitarFlyoverDto {
  @IsOptional()
  @IsIn(ESTILOS_FLYOVER)
  estilo?: EstiloFlyover;
}
