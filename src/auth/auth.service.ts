import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { VerificacionCorreoService } from './verificacion-correo.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private verificacionCorreo: VerificacionCorreoService,
  ) {}

  private async correoYaRegistrado(correo: string): Promise<boolean> {
    const [miembro, solicitud] = await Promise.all([
      this.prisma.miembro.findUnique({ where: { correo } }),
      this.prisma.solicitudRegistro.findUnique({ where: { correo } }),
    ]);
    return !!miembro || !!solicitud;
  }

  async enviarCodigoVerificacion(correo: string) {
    if (await this.correoYaRegistrado(correo)) {
      throw new ConflictException(
        'Ese correo ya tiene una cuenta o solicitud.',
      );
    }
    const codigoDev = this.verificacionCorreo.generarCodigo(correo);
    return {
      mensaje: 'Código enviado (modo simulado, ver codigoDev).',
      codigoDev,
    };
  }

  confirmarCodigoVerificacion(correo: string, codigo: string) {
    const resultado = this.verificacionCorreo.confirmarCodigo(correo, codigo);
    if (!resultado.ok) {
      throw new BadRequestException(resultado.error);
    }
    return { mensaje: 'Correo verificado.' };
  }

  private firmarToken(miembro: {
    id: number;
    correo: string;
    nombre: string;
    rol: string;
  }) {
    const payload = {
      sub: miembro.id,
      correo: miembro.correo,
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
      where: { correo: dto.correo },
    });

    if (!miembro) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const claveValida = await bcrypt.compare(dto.clave, miembro.passwordHash);
    if (!claveValida) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    return this.firmarToken(miembro);
  }

  async registrar(dto: RegistroDto) {
    if (await this.correoYaRegistrado(dto.correo)) {
      throw new ConflictException('Ese correo ya tiene una cuenta o solicitud');
    }

    if (!this.verificacionCorreo.estaVerificado(dto.correo)) {
      throw new BadRequestException(
        'Primero verifica tu correo con el código enviado.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.clave, 10);

    const solicitud = await this.prisma.solicitudRegistro.create({
      data: {
        nombre: dto.nombre,
        correo: dto.correo,
        fechaNacimiento: new Date(dto.fechaNacimiento),
        fotoUrl: dto.fotoUrl,
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
      select: {
        id: true,
        nombre: true,
        correo: true,
        fechaNacimiento: true,
        fotoUrl: true,
        telefono: true,
        ciudad: true,
        createdAt: true,
      },
    });
  }

  async aprobarSolicitud(id: number, categoria: 'legion' | 'comunidad') {
    const solicitud = await this.prisma.solicitudRegistro.findUnique({
      where: { id },
    });
    if (!solicitud || solicitud.estado !== 'pendiente') {
      throw new ConflictException('Solicitud no encontrada o ya resuelta');
    }
    if (!solicitud.correo) {
      throw new ConflictException('La solicitud no tiene un correo válido');
    }

    const miembro = await this.prisma.miembro.create({
      data: {
        nombre: solicitud.nombre,
        correo: solicitud.correo,
        fechaNacimiento: solicitud.fechaNacimiento,
        fotoUrl: solicitud.fotoUrl,
        telefono: solicitud.telefono,
        passwordHash: solicitud.passwordHash,
        ciudad: solicitud.ciudad,
        rol: 'usuario',
        categoria,
      },
    });

    await this.prisma.solicitudRegistro.update({
      where: { id },
      data: { estado: 'aceptada' },
    });

    return { id: miembro.id, mensaje: 'Solicitud aprobada' };
  }

  // Categoría interna (Legión/Comunidad) editable después de aprobar, solo
  // por el admin — ver comentario en schema.prisma sobre el uso futuro.
  async cambiarCategoria(id: number, categoria: 'legion' | 'comunidad') {
    await this.prisma.miembro.update({
      where: { id },
      data: { categoria },
    });
    return { mensaje: 'Categoría actualizada' };
  }

  async rechazarSolicitud(id: number) {
    await this.prisma.solicitudRegistro.update({
      where: { id },
      data: { estado: 'rechazada' },
    });
    return { mensaje: 'Solicitud rechazada' };
  }

  async miembros() {
    return this.prisma.miembro.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        correo: true,
        fechaNacimiento: true,
        fotoUrl: true,
        telefono: true,
        ciudad: true,
        rol: true,
        categoria: true,
        createdAt: true,
      },
    });
  }
}
