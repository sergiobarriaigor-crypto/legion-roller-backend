import { IsEmail, IsString, Length } from 'class-validator';

export class EnviarCodigoDto {
  @IsEmail()
  correo: string;
}

export class ConfirmarCodigoDto {
  @IsEmail()
  correo: string;

  @IsString()
  @Length(6, 6)
  codigo: string;
}
