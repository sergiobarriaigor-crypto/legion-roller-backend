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
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { AprobarSolicitudDto } from './dto/aprobar-solicitud.dto';
import { CambiarCategoriaDto } from './dto/cambiar-categoria.dto';
import {
  ConfirmarCodigoDto,
  EnviarCodigoDto,
} from './dto/verificar-correo.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('registro')
  registrar(@Body() dto: RegistroDto) {
    return this.authService.registrar(dto);
  }

  @Post('correo/enviar-codigo')
  enviarCodigoCorreo(@Body() dto: EnviarCodigoDto) {
    return this.authService.enviarCodigoVerificacion(dto.correo);
  }

  @Post('correo/confirmar-codigo')
  confirmarCodigoCorreo(@Body() dto: ConfirmarCodigoDto) {
    return this.authService.confirmarCodigoVerificacion(dto.correo, dto.codigo);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: unknown }) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('solicitudes')
  solicitudesPendientes() {
    return this.authService.listarSolicitudesPendientes();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('miembros')
  miembros() {
    return this.authService.miembros();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('solicitudes/:id/aprobar')
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprobarSolicitudDto,
  ) {
    return this.authService.aprobarSolicitud(id, dto.categoria);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('solicitudes/:id/rechazar')
  rechazar(@Param('id', ParseIntPipe) id: number) {
    return this.authService.rechazarSolicitud(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('miembros/:id/categoria')
  cambiarCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarCategoriaDto,
  ) {
    return this.authService.cambiarCategoria(id, dto.categoria);
  }
}
