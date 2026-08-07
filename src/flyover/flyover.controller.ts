import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FlyoverService } from './flyover.service';

interface RequestConUsuario {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('flyover')
export class FlyoverController {
  constructor(private flyoverService: FlyoverService) {}

  @Post(':recorridoId')
  solicitar(
    @Req() req: RequestConUsuario,
    @Param('recorridoId', ParseIntPipe) recorridoId: number,
  ) {
    return this.flyoverService.solicitarGeneracion(req.user.id, recorridoId);
  }

  @Get('recorrido/:recorridoId')
  porRecorrido(
    @Req() req: RequestConUsuario,
    @Param('recorridoId', ParseIntPipe) recorridoId: number,
  ) {
    return this.flyoverService.estadoPorRecorrido(recorridoId, req.user.id);
  }

  @Get(':id')
  porId(@Req() req: RequestConUsuario, @Param('id', ParseIntPipe) id: number) {
    return this.flyoverService.estadoPorId(id, req.user.id);
  }
}
