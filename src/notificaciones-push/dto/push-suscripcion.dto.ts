import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';

export class PushSuscripcionClavesDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

export class PushSuscripcionDto {
  @IsString()
  endpoint: string;

  @ValidateNested()
  @Type(() => PushSuscripcionClavesDto)
  keys: PushSuscripcionClavesDto;
}
