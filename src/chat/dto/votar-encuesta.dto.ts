import { IsInt } from 'class-validator';

export class VotarEncuestaDto {
  @IsInt()
  opcionId!: number;
}
