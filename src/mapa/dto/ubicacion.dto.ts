import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UbicacionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @IsOptional()
  @IsIn(['patinando', 'ruta'])
  modo?: string;
}
