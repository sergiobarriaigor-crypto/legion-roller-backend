import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PerfilService } from './perfil.service';
import { EstadoDto } from './dto/estado.dto';
import { FotoDto } from './dto/foto.dto';
import { FotoGaleriaDto } from './dto/foto-galeria.dto';
import { ReconocimientoDto } from './dto/reconocimiento.dto';

interface RequestConUsuario {
  user: { id: number; rol: string };
}

@UseGuards(JwtAuthGuard)
@Controller('perfil')
export class PerfilController {
  constructor(private perfilService: PerfilService) {}

  @Get('mio')
  mio(@Req() req: RequestConUsuario) {
    return this.perfilService.miPerfil(req.user.id);
  }

  @Get(':id')
  ver(@Param('id', ParseIntPipe) id: number) {
    return this.perfilService.perfilPublico(id);
  }

  @Patch('tecnicas/:tecnica')
  toggleTecnica(
    @Req() req: RequestConUsuario,
    @Param('tecnica') tecnica: string,
  ) {
    return this.perfilService.toggleTecnica(req.user.id, tecnica);
  }

  @Put('estado')
  setEstado(@Req() req: RequestConUsuario, @Body() dto: EstadoDto) {
    return this.perfilService.setEstado(req.user.id, dto.texto);
  }

  @Delete('estado')
  limpiarEstado(@Req() req: RequestConUsuario) {
    return this.perfilService.limpiarEstado(req.user.id);
  }

  @Put('foto')
  setFoto(@Req() req: RequestConUsuario, @Body() dto: FotoDto) {
    return this.perfilService.setFoto(req.user.id, dto.fotoUrl);
  }

  @Delete('foto')
  quitarFoto(@Req() req: RequestConUsuario) {
    return this.perfilService.quitarFoto(req.user.id);
  }

  @Post(':id/reconocimientos')
  enviarReconocimiento(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReconocimientoDto,
  ) {
    return this.perfilService.enviarReconocimiento(req.user.id, id, dto.texto);
  }

  @Get(':id/galeria')
  galeriaDe(
    @Req() req: RequestConUsuario,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.perfilService.galeriaDe(id, req.user.id);
  }

  @Post('galeria')
  agregarFotoGaleria(
    @Req() req: RequestConUsuario,
    @Body() dto: FotoGaleriaDto,
  ) {
    return this.perfilService.agregarFotoGaleria(req.user.id, dto.url);
  }

  @Delete('galeria/:fotoId')
  eliminarFotoGaleria(
    @Req() req: RequestConUsuario,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.perfilService.eliminarFotoGaleria(
      fotoId,
      req.user.id,
      req.user.rol,
    );
  }

  @Post('galeria/:fotoId/reaccion')
  toggleReaccionFoto(
    @Req() req: RequestConUsuario,
    @Param('fotoId', ParseIntPipe) fotoId: number,
  ) {
    return this.perfilService.toggleReaccionFoto(fotoId, req.user.id);
  }
}
