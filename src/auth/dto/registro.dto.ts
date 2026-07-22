import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegistroDto {
  @IsString()
  nombre: string;

  @IsEmail()
  correo: string;

  @IsDateString()
  fechaNacimiento: string;

  @IsString()
  fotoUrl: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, {
    message: 'La contraseña debe contener al menos una letra mayúscula',
  })
  clave: string;
}
