import { IsUrl } from 'class-validator';

export class FotoGaleriaDto {
  @IsUrl({ require_tld: false })
  url: string;
}
