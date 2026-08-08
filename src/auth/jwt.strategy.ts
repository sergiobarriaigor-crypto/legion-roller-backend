import { ForbiddenException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { obtenerEstadoCuenta } from './estado-cuenta.util';

interface JwtPayload {
  sub: number;
  correo: string;
  nombre: string;
  rol: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-cambiar-en-produccion',
    });
  }

  // Async a propósito: el JWT por sí solo no basta para saber si la cuenta
  // sigue activa (dura 30 días y no lleva estado de bloqueo embebido) -- se
  // valida contra la BD en cada request para que un bloqueo/eliminación
  // decidido por un admin corte de inmediato cualquier sesión ya abierta.
  async validate(payload: JwtPayload) {
    const estado = await obtenerEstadoCuenta(this.prisma, payload.sub);
    if (!estado.activa) {
      throw new ForbiddenException(estado.motivo);
    }
    return {
      id: payload.sub,
      correo: payload.correo,
      nombre: payload.nombre,
      rol: payload.rol,
    };
  }
}
