import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsInt,
} from 'class-validator';

const MAX_DESTINATARIOS_COMPARTIR = 5;

export class CompartirEmprendedorDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DESTINATARIOS_COMPARTIR)
  @ArrayUnique()
  @IsInt({ each: true })
  destinatarioIds: number[];
}
