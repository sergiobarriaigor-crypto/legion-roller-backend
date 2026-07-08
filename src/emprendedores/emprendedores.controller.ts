import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EmprendedoresService } from './emprendedores.service';
import { FichaEmprendedorDto } from './dto/ficha-emprendedor.dto';
import { ResenaDto } from './dto/resena.dto';
import { AnuncioDto } from './dto/anuncio.dto';

interface RequestConUsuario {
  user: { id: number; rol: string };
}

@Controller('emprendedores')
export class EmprendedoresController {
  constructor(private emprendedoresService: EmprendedoresService) {}

  @Get()
  directorio() {
    return this.emprendedoresService.directorio();
  }

  @UseGuards(JwtAuthGuard)
  @Get('mi-ficha')
  miFicha(@Req() req: RequestConUsuario) {
    return this.emprendedoresService.miFicha(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mi-ficha')
  guardarFicha(@Req() req: RequestConUsuario, @Body() dto: FichaEmprendedorDto) {
    return this.emprendedoresService.guardarFicha(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('mi-ficha')
  eliminarMiFicha(@Req() req: RequestConUsuario) {
    return this.emprendedoresService.eliminarMiFicha(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solicitudes')
  solicitudes() {
    return this.emprendedoresService.solicitudesPendientes();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/aprobar')
  aprobar(@Param('id', ParseIntPipe) id: number) {
    return this.emprendedoresService.aprobar(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/rechazar')
  rechazar(@Param('id', ParseIntPipe) id: number) {
    return this.emprendedoresService.rechazar(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  eliminarComoAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.emprendedoresService.eliminarComoAdmin(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reaccion')
  toggleReaccion(@Req() req: RequestConUsuario, @Param('id', ParseIntPipe) id: number) {
    return this.emprendedoresService.toggleReaccion(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/resenas')
  agregarResena(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResenaDto,
  ) {
    return this.emprendedoresService.agregarResena(id, req.user.id, dto.texto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/anuncios')
  agregarAnuncio(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnuncioDto,
  ) {
    return this.emprendedoresService.agregarAnuncio(id, req.user.id, dto.texto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/anuncios/:anuncioId')
  eliminarAnuncio(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Param('anuncioId', ParseIntPipe) anuncioId: number,
  ) {
    return this.emprendedoresService.eliminarAnuncio(id, anuncioId, req.user.id);
  }
}
