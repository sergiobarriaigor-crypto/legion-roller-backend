import {
  Body,
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
import { SolicitarFlyoverDto } from './dto/solicitar-flyover.dto';

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
    @Body() dto: SolicitarFlyoverDto,
  ) {
    return this.flyoverService.solicitarGeneracion(
      req.user.id,
      recorridoId,
      dto.estilo,
    );
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
