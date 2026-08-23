import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
  activarPatinando(@Req() req: RequestConUsuario, @Body() dto: UbicacionDto) {
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

  @Get('rodadas-cercanas')
  rodadasCercanas(
    @Req() req: RequestConUsuario,
    @Query('lat') lat: string,
    @Query('lon') lon: string,
  ) {
    return this.mapaService.rodadasCercanas(
      req.user.id,
      Number(lat),
      Number(lon),
    );
  }

  @Post('recorridos')
  guardarRecorrido(@Req() req: RequestConUsuario, @Body() dto: RecorridoDto) {
    return this.mapaService.guardarRecorrido(req.user.id, dto);
  }

  @Get('recorridos')
  misRecorridos(@Req() req: RequestConUsuario) {
    return this.mapaService.misRecorridos(req.user.id);
  }

  @Get('historial')
  historialRecorridos(@Req() req: RequestConUsuario) {
    return this.mapaService.historialRecorridos(req.user.id);
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

  // DIAGNÓSTICO TEMPORAL -- ver comentario completo en
  // diagnosticoPuntosCrudos() (mapa.service.ts). Protegido por el mismo
  // JwtAuthGuard del controller y por el mismo chequeo de pertenencia
  // (miembroId) que eliminarRecorrido/alternarFavorito -- nunca devuelve
  // datos de un recorrido ajeno. Solo lectura. BORRAR esta ruta (y el
  // método de servicio) una vez cerrada la investigación GPS.
  @Get('recorridos/:id/diagnostico-temporal')
  diagnosticoPuntosCrudos(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mapaService.diagnosticoPuntosCrudos(req.user.id, id);
  }

  // DIAGNÓSTICO TEMPORAL -- ver comentario completo en diagnosticoGps()
  // (mapa.service.ts). Mismo JwtAuthGuard + chequeo de pertenencia que el
  // resto de las rutas de diagnóstico. BORRAR junto con el resto.
  @Get('recorridos/:id/diagnostico-gps')
  diagnosticoGps(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mapaService.diagnosticoGps(req.user.id, id);
  }
}
