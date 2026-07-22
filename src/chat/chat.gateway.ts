import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ChatPresenceService } from './chat-presence.service';

interface JwtPayload {
  sub: number;
  nombre: string;
}

interface SocketAutenticado extends Socket {
  data: { miembroId?: number; nombre?: string };
}

const PATRON_SALA_INDIVIDUAL = /^dm-(\d+)-(\d+)$/;

function salaSocket(sala: string) {
  return `chat-${sala}`;
}

function salaPersonal(miembroId: number) {
  return `miembro-${miembroId}`;
}

// A diferencia de historias.gateway.ts (donde el propio evento de socket
// persiste), acá el envío/mutación sigue siendo 100% REST (ChatController) —
// este gateway solo agrega presencia, "escribiendo..." (efímero, sin guardar)
// y retransmite en vivo lo que ChatService ya persistió, para no tocar los
// llamadores existentes de POST /chat/mensajes/:sala.
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private presencia: ChatPresenceService,
  ) {}

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
      void client.join(salaPersonal(payload.sub));
      this.presencia.conectar(payload.sub, client.id);
      this.server.emit('chat:presencia', {
        miembroId: payload.sub,
        enLinea: true,
        ultimaConexion: null,
      });
    } catch {
      this.logger.warn('Conexión de socket rechazada: token inválido');
      client.disconnect();
    }
  }

  async handleDisconnect(client: SocketAutenticado) {
    const miembroId = client.data.miembroId;
    if (!miembroId) return;
    const quedoDesconectado = this.presencia.desconectar(miembroId, client.id);
    if (!quedoDesconectado) return;

    const ahora = new Date();
    await this.prisma.miembro.update({
      where: { id: miembroId },
      data: { ultimaConexion: ahora },
    });
    this.server.emit('chat:presencia', {
      miembroId,
      enLinea: false,
      ultimaConexion: ahora.toISOString(),
    });
  }

  @SubscribeMessage('chat:unirse')
  async unirse(
    @ConnectedSocket() client: SocketAutenticado,
    @MessageBody() sala: string,
  ) {
    void client.join(salaSocket(sala));
    const miembroId = client.data.miembroId;
    if (!miembroId) return;

    // Entrar a la sala cuenta como "ya lo recibió" — cubre reconectar y ver
    // mensajes pendientes sin necesitar un ack por mensaje.
    const ahora = new Date();
    await this.prisma.lecturaChat.upsert({
      where: { miembroId_sala: { miembroId, sala } },
      create: {
        miembroId,
        sala,
        leidoHasta: new Date(0),
        entregadoHasta: ahora,
      },
      update: { entregadoHasta: ahora },
    });
    this.server
      .to(salaSocket(sala))
      .emit('chat:entregado', { sala, miembroId, hasta: ahora.toISOString() });
  }

  @SubscribeMessage('chat:salir')
  salir(
    @ConnectedSocket() client: SocketAutenticado,
    @MessageBody() sala: string,
  ) {
    void client.leave(salaSocket(sala));
  }

  // Puramente efímero (no se guarda nada) — igual que el resto de la app trata
  // lo "en vivo sin persistir".
  @SubscribeMessage('chat:escribiendo')
  escribiendo(
    @ConnectedSocket() client: SocketAutenticado,
    @MessageBody() data: { sala: string; escribiendo: boolean },
  ) {
    const miembroId = client.data.miembroId;
    if (!miembroId) return;
    client.to(salaSocket(data.sala)).emit('chat:escribiendo', {
      sala: data.sala,
      miembroId,
      nombre: client.data.nombre,
      escribiendo: data.escribiendo,
    });
  }

  // Llamado desde ChatService después de persistir cada mutación (mensaje
  // nuevo, reacción, eliminación, lectura/entrega) — retransmite a quien tenga
  // la sala abierta Y a la sala personal de cada participante de un DM (así el
  // badge de no-leídos y la lista de conversaciones se actualizan en vivo
  // aunque no tengan ese chat abierto).
  emitir(sala: string, evento: string, payload: unknown) {
    // Un solo .to(...).emit() con la unión de salas: Socket.IO entrega un solo
    // paquete por socket aunque esté en varias de las salas apuntadas — dos
    // llamadas separadas duplicaría el evento para quien esté en ambas.
    const salas = [salaSocket(sala)];
    const match = PATRON_SALA_INDIVIDUAL.exec(sala);
    if (match) {
      salas.push(
        salaPersonal(Number(match[1])),
        salaPersonal(Number(match[2])),
      );
    }
    this.server.to(salas).emit(evento, payload);
  }
}
