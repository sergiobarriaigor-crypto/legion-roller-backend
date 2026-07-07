import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private firmarToken(miembro: {
    id: number;
    telefono: string;
    nombre: string;
    rol: string;
  }) {
    const payload = {
      sub: miembro.id,
      telefono: miembro.telefono,
      nombre: miembro.nombre,
      rol: miembro.rol,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      id: miembro.id,
      nombre: miembro.nombre,
      rol: miembro.rol,
    };
  }

  async login(dto: LoginDto) {
    const miembro = await this.prisma.miembro.findUnique({
      where: { telefono: dto.telefono },
    });

    if (!miembro) {
      throw new UnauthorizedException('Teléfono o contraseña incorrectos');
    }

    const claveValida = await bcrypt.compare(dto.clave, miembro.passwordHash);
    if (!claveValida) {
      throw new UnauthorizedException('Teléfono o contraseña incorrectos');
    }

    return this.firmarToken(miembro);
  }

  async registrar(dto: RegistroDto) {
    const existente = await this.prisma.miembro.findUnique({
      where: { telefono: dto.telefono },
    });
    if (existente) {
      throw new ConflictException('Ese teléfono ya tiene una cuenta');
    }

    const solicitudExistente = await this.prisma.solicitudRegistro.findUnique({
      where: { telefono: dto.telefono },
    });
    if (solicitudExistente) {
      throw new ConflictException('Ya existe una solicitud con ese teléfono');
    }

    const passwordHash = await bcrypt.hash(dto.clave, 10);

    const solicitud = await this.prisma.solicitudRegistro.create({
      data: {
        nombre: dto.nombre,
        telefono: dto.telefono,
        ciudad: dto.ciudad,
        passwordHash,
      },
    });

    return {
      id: solicitud.id,
      mensaje: 'Solicitud enviada, pendiente de aprobación de un admin',
    };
  }

  async listarSolicitudesPendientes() {
    return this.prisma.solicitudRegistro.findMany({
      where: { estado: 'pendiente' },
      select: { id: true, nombre: true, telefono: true, ciudad: true, createdAt: true },
    });
  }

  async aprobarSolicitud(id: number) {
    const solicitud = await this.prisma.solicitudRegistro.findUnique({
      where: { id },
    });
    if (!solicitud || solicitud.estado !== 'pendiente') {
      throw new ConflictException('Solicitud no encontrada o ya resuelta');
    }

    const miembro = await this.prisma.miembro.create({
      data: {
        nombre: solicitud.nombre,
        telefono: solicitud.telefono,
        passwordHash: solicitud.passwordHash,
        ciudad: solicitud.ciudad,
        rol: 'usuario',
      },
    });

    await this.prisma.solicitudRegistro.update({
      where: { id },
      data: { estado: 'aceptada' },
    });

    return { id: miembro.id, mensaje: 'Solicitud aprobada' };
  }

  async rechazarSolicitud(id: number) {
    await this.prisma.solicitudRegistro.update({
      where: { id },
      data: { estado: 'rechazada' },
    });
    return { mensaje: 'Solicitud rechazada' };
  }
}
