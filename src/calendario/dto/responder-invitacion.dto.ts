import { IsIn } from 'class-validator';

export class ResponderInvitacionDto {
  @IsIn(['aceptada', 'rechazada'])
  estado: string;
}
