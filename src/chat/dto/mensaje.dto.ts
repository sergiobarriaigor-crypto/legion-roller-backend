import { IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class MensajeDto {
  @IsString()
  @MinLength(1)
  texto: string;

  @IsOptional()
  @IsIn(['post', 'emprendedor', 'historia'])
  referenciaTipo?: string;

  @IsOptional()
  @IsInt()
  referenciaId?: number;
}
