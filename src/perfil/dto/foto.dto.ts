import { IsUrl } from 'class-validator';

export class FotoDto {
  @IsUrl({ require_tld: false })
  fotoUrl: string;
}
