import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

interface JwtPayload {
  sub: number;
  nombre: string;
}

interface SocketAutenticado extends Socket {
  data: { miembroId?: number; nombre?: string };
}

function nombreSala(historiaId: number) {
  return `historia-${historiaId}`;
}

// Mensajes flotantes en vivo sobre una historia (estilo comentarios de un
// live): a diferencia de la mención/reacción persistente ya existente, esto
// NO se guarda en ningún lado — solo se retransmite a quien esté viendo esa
// misma historia en ese momento, mientras la tenga abierta.
@WebSocketGateway({ cors: { origin: '*' } })
export class HistoriasGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(HistoriasGateway.name);

  constructor(private jwtService: JwtService) {}

  handleConnection(client: SocketAutenticado) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.miembroId = payload.sub;
      client.data.nombre = payload.nombre;
    } catch {
      this.logger.warn('Conexión de socket rechazada: token inválido');
      client.disconnect();
    }
  }

  @SubscribeMessage('historia:unirse')
  unirse(
    @ConnectedSocket() client: SocketAutenticado,
    @MessageBody() historiaId: number,
  ) {
    void client.join(nombreSala(historiaId));
  }

  @SubscribeMessage('historia:salir')
  salir(
    @ConnectedSocket() client: SocketAutenticado,
    @MessageBody() historiaId: number,
  ) {
    void client.leave(nombreSala(historiaId));
  }

  // Texto libre, efímero — no persiste, solo se retransmite en vivo.
  @SubscribeMessage('historia:mensaje')
  mensaje(
    @ConnectedSocket() client: SocketAutenticado,
    @MessageBody() data: { historiaId: number; texto: string },
  ) {
    const texto = data?.texto?.trim().slice(0, 200);
    if (!client.data.miembroId || !texto) return;
    this.server.to(nombreSala(data.historiaId)).emit('historia:mensaje', {
      miembroId: client.data.miembroId,
      nombre: client.data.nombre,
      texto,
      createdAt: new Date().toISOString(),
    });
  }

  // Llamado desde HistoriasService al reaccionar (la reacción SÍ se guarda,
  // vía el endpoint REST de siempre) — esto solo agrega la capa en vivo para
  // quien esté viendo la historia en ese momento.
  emitirReaccion(historiaId: number, miembroId: number, nombre: string) {
    this.server.to(nombreSala(historiaId)).emit('historia:reaccion', {
      miembroId,
      nombre,
      createdAt: new Date().toISOString(),
    });
  }
}
