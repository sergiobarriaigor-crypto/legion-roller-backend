import { IsIn } from 'class-validator';

export class RsvpDto {
  @IsIn(['yes', 'maybe', 'no'])
  estado: string;
}
