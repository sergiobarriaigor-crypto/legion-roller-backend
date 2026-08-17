import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private async correoYaRegistrado(correo: string): Promise<boolean> {
    const [miembro, solicitud] = await Promise.all([
      this.prisma.miembro.findUnique({ where: { correo } }),
      this.prisma.solicitudRegistro.findUnique({ where: { correo } }),
    ]);
    return !!miembro || !!solicitud;
  }

  // Sin distinción de mayúsculas/minúsculas -- a diferencia del correo (un
  // identificador técnico de cuenta), el nombre/apodo es lo que ven el resto
  // de los integrantes, así que "Kitty" y "kitty" igual generarían la misma
  // confusión de identidad. Las solicitudes ya rechazadas no cuentan (ese
  // nombre queda libre de nuevo); las pendientes sí, para que dos solicitudes
  // con el mismo nombre no puedan quedar ambas esperando aprobación a la vez.
  private async nombreYaUsado(nombre: string): Promise<boolean> {
    const [miembro, solicitud] = await Promise.all([
      this.prisma.miembro.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' } },
      }),
      this.prisma.solicitudRegistro.findFirst({
        where: {
          nombre: { equals: nombre, mode: 'insensitive' },
          estado: 'pendiente',
        },
      }),
    ]);
    return !!miembro || !!solicitud;
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

    // Cuenta eliminada: el correo ya fue reemplazado por un placeholder al
    // eliminar (ver eliminarMiembro), así que en la práctica este chequeo
    // nunca debería alcanzarse por correo original -- se deja igual como
    // defensa en profundidad.
    if (miembro.eliminadoEn) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    if (miembro.bloqueadoHasta && miembro.bloqueadoHasta > new Date()) {
      const fecha = miembro.bloqueadoHasta.toLocaleString('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const motivo = miembro.bloqueadoMotivo
        ? `: ${miembro.bloqueadoMotivo}`
        : '.';
      throw new ForbiddenException(
        `Tu cuenta está bloqueada hasta ${fecha}${motivo}`,
      );
    }

    return this.firmarToken(miembro);
  }

  async registrar(dto: RegistroDto) {
    if (await this.correoYaRegistrado(dto.correo)) {
      throw new ConflictException('Ese correo ya tiene una cuenta o solicitud');
    }
    if (await this.nombreYaUsado(dto.nombre)) {
      throw new ConflictException('Ese nombre o apodo ya está en uso.');
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
        bloqueadoHasta: true,
        bloqueadoMotivo: true,
        eliminadoEn: true,
      },
    });
  }

  // Moderación (ver comentario en schema.prisma sobre Miembro): un admin no
  // puede bloquear ni eliminar a otro admin -- mismo criterio que ya aplica
  // el frontend para el selector de categoría, ahora también forzado acá.
  async bloquearMiembro(id: number, dias: number, motivo?: string) {
    const miembro = await this.prisma.miembro.findUnique({ where: { id } });
    if (!miembro || miembro.rol === 'admin') {
      throw new ForbiddenException('No se puede bloquear a este miembro.');
    }
    const bloqueadoHasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    await this.prisma.miembro.update({
      where: { id },
      data: { bloqueadoHasta, bloqueadoMotivo: motivo ?? null },
    });
    return { mensaje: 'Miembro bloqueado', bloqueadoHasta };
  }

  async desbloquearMiembro(id: number) {
    await this.prisma.miembro.update({
      where: { id },
      data: { bloqueadoHasta: null, bloqueadoMotivo: null },
    });
    return { mensaje: 'Miembro desbloqueado' };
  }

  // Anonimiza en vez de borrar: el contenido ya publicado (posts, mensajes,
  // rutas, reseñas) sigue visible para no romper hilos ni conversaciones
  // grupales de terceros, pero deja de tener nombre/foto/datos de contacto
  // reales. El correo se reemplaza por un placeholder único (en vez de
  // null, porque sigue siendo @unique) para que ya no pueda iniciar sesión
  // con su correo original; passwordHash también se invalida como defensa
  // adicional.
  async eliminarMiembro(id: number) {
    const miembro = await this.prisma.miembro.findUnique({ where: { id } });
    if (!miembro || miembro.rol === 'admin') {
      throw new ForbiddenException('No se puede eliminar a este miembro.');
    }
    const claveInutil = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
    await this.prisma.miembro.update({
      where: { id },
      data: {
        nombre: 'Usuario eliminado',
        correo: `eliminado-${id}@legion-roller.local`,
        telefono: null,
        fotoUrl: null,
        ciudad: null,
        fechaNacimiento: null,
        passwordHash: claveInutil,
        bloqueadoHasta: null,
        bloqueadoMotivo: null,
        eliminadoEn: new Date(),
      },
    });
    return { mensaje: 'Cuenta eliminada' };
  }
}
