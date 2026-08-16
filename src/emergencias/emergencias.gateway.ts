import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { obtenerEstadoCuenta } from '../auth/estado-cuenta.util';

interface JwtPayload {
  sub: number;
  nombre: string;
}

interface SocketAutenticado extends Socket {
  data: { miembroId?: number; nombre?: string };
}

// Mismo criterio que MapaGateway: un SOS le tiene que llegar a cualquier
// miembro conectado, no solo a los de alguna sala/conversación puntual --
// por eso es un broadcast global (this.server.emit), sin unirse a salas.
// A propósito NO se manda acá el objeto de la emergencia completo (con
// nombre/foto/ubicación ya armados) -- el evento es solo un "aviso de que
// algo cambió"; el cliente reacciona volviendo a pedir GET
// /emergencias/activas (ver EmergenciaContext.tsx), que sigue siendo la
// única fuente de verdad. Evita duplicar acá el join con Miembro que ya
// hace EmergenciasService.activas().
@WebSocketGateway({ cors: { origin: '*' } })
export class EmergenciasGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EmergenciasGateway.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: SocketAutenticado) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const estado = await obtenerEstadoCuenta(this.prisma, payload.sub);
      if (!estado.activa) {
        this.logger.warn(
          'Conexión de socket rechazada: cuenta bloqueada o eliminada',
        );
        client.disconnect();
        return;
      }
      client.data.miembroId = payload.sub;
      client.data.nombre = payload.nombre;
    } catch {
      this.logger.warn('Conexión de socket rechazada: token inválido');
      client.disconnect();
    }
  }

  // Llamados desde EmergenciasService.activar()/cancelar() después de
  // escribir en la base -- el polling a /emergencias/activas (ver
  // EmergenciaContext.tsx) queda solo como respaldo de reconciliación.
  emitirActivacion(miembroId: number) {
    this.server.emit('emergencia:activada', { miembroId });
  }

  emitirCancelacion(miembroId: number) {
    this.server.emit('emergencia:cancelada', { miembroId });
  }
}
