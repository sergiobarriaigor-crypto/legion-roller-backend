import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class BloquearMiembroDto {
  @IsIn([1, 3, 7, 30])
  dias: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
