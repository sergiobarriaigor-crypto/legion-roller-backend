import { IsOptional, IsString } from 'class-validator';

export class CancelarActividadDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}
