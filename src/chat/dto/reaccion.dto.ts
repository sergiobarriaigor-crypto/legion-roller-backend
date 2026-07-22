import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReaccionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  emoji: string;
}
