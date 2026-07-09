import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MapaService } from './mapa.service';
import { UbicacionDto } from './dto/ubicacion.dto';
import { RecorridoDto } from './dto/recorrido.dto';

interface RequestConUsuario {
  user: { id: number };
}

@UseGuards(JwtAuthGuard)
@Controller('mapa')
export class MapaController {
  constructor(private mapaService: MapaService) {}

  @Post('patinando')
  activarPatinando(
    @Req() req: RequestConUsuario,
    @Body() dto: UbicacionDto,
  ) {
    return this.mapaService.activarPatinando(req.user.id, dto);
  }

  @Delete('patinando')
  terminarPatinando(@Req() req: RequestConUsuario) {
    return this.mapaService.terminarPatinando(req.user.id);
  }

  @Get('patinando-ahora')
  patinandoAhora() {
    return this.mapaService.patinandoAhora();
  }

  @Post('recorridos')
  guardarRecorrido(
    @Req() req: RequestConUsuario,
    @Body() dto: RecorridoDto,
  ) {
    return this.mapaService.guardarRecorrido(req.user.id, dto);
  }

  @Get('recorridos')
  misRecorridos(@Req() req: RequestConUsuario) {
    return this.mapaService.misRecorridos(req.user.id);
  }

  @Delete('recorridos/:id')
  eliminarRecorrido(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mapaService.eliminarRecorrido(req.user.id, id);
  }

  @Patch('recorridos/:id/favorito')
  alternarFavorito(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mapaService.alternarFavorito(req.user.id, id);
  }
}
