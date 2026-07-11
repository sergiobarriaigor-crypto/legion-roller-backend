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
import { PrismaService } from '../prisma/prisma.service';

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
// live): se retransmiten de inmediato a quien esté viendo esa misma historia
// en ese momento, Y se guardan como ComentarioHistoria para que el autor
// pueda revisarlos más tarde aunque no haya estado conectado.
@WebSocketGateway({ cors: { origin: '*' } })
export class HistoriasGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(HistoriasGateway.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
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

  // Se retransmite de inmediato (burbuja flotante) y además se guarda, para
  // que cualquiera pueda verlo más tarde desde "Ver comentarios". Puede venir
  // con `respuestaAId` para responder a un comentario existente (hilo de un
  // solo nivel: solo se acepta si el objetivo no es a su vez una respuesta).
  @SubscribeMessage('historia:mensaje')
  async mensaje(
    @ConnectedSocket() client: SocketAutenticado,
    @MessageBody()
    data: { historiaId: number; texto: string; respuestaAId?: number },
  ) {
    const texto = data?.texto?.trim().slice(0, 200);
    const miembroId = client.data.miembroId;
    if (!miembroId || !texto) return;

    let respuestaAId: number | null = null;
    if (data.respuestaAId) {
      const objetivo = await this.prisma.comentarioHistoria.findUnique({
        where: { id: data.respuestaAId },
      });
      if (
        objetivo &&
        objetivo.historiaId === data.historiaId &&
        !objetivo.respuestaAId
      ) {
        respuestaAId = objetivo.id;
      }
    }

    const comentario = await this.prisma.comentarioHistoria.create({
      data: {
        historiaId: data.historiaId,
        autorId: miembroId,
        texto,
        respuestaAId,
      },
    });

    this.server.to(nombreSala(data.historiaId)).emit('historia:mensaje', {
      id: comentario.id,
      miembroId,
      nombre: client.data.nombre,
      texto,
      respuestaAId,
      createdAt: comentario.createdAt.toISOString(),
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
