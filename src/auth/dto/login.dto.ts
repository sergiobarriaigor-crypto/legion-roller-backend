import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  telefono: string;

  @IsString()
  @MinLength(4)
  clave: string;
}
