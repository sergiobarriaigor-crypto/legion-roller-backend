import { IsIn } from 'class-validator';

export class CambiarCategoriaDto {
  @IsIn(['legion', 'comunidad'])
  categoria: 'legion' | 'comunidad';
}
