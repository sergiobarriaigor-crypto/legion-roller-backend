import { IsOptional, IsString } from 'class-validator';

export class NotificarmePushDto {
  @IsString()
  titulo: string;

  @IsString()
  cuerpo: string;

  @IsOptional()
  @IsString()
  url?: string;
}
