import { IsBoolean } from 'class-validator';

export class SilenciarDto {
  @IsBoolean()
  silenciado: boolean;
}
