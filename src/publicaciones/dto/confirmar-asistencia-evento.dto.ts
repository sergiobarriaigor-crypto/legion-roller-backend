import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ConfirmarAsistenciaEventoDto {
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lon?: number;

  @IsOptional()
  @IsString()
  codigo?: string;
}
