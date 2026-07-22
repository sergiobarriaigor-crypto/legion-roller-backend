import { IsIn } from 'class-validator';

export class AprobarSolicitudDto {
  @IsIn(['legion', 'comunidad'])
  categoria: 'legion' | 'comunidad';
}
