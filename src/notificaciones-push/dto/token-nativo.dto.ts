import { IsString } from 'class-validator';

export class TokenNativoDto {
  @IsString()
  token: string;
}
