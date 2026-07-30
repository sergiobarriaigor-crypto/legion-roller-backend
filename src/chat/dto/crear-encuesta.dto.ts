import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CrearEncuestaDto {
  @IsString()
  @MaxLength(300)
  pregunta!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  opciones!: string[];

  @IsOptional()
  @IsBoolean()
  anonima?: boolean;
}
