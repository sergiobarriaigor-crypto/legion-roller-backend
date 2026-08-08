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

export interface UbicacionEmitida {
  miembroId: number;
  nombre: string;
  fotoUrl: string | null;
  estado: string | null;
  lat: number;
  lon: number;
  modo: string;
  iniciadoEn: Date;
}

// A diferencia de historias/chat (retransmisión por sala), el mapa no está
// segmentado por conversación/historia -- cualquier miembro conectado puede
// ver a cualquier otro patinando, igual que ya hace GET /mapa/patinando-ahora
// (ver mapa.service.ts). Por eso se transmite con un broadcast global
// (this.server.emit), sin unirse a ninguna sala -- mismo criterio que
// "chat:presencia" en ChatGateway.
@WebSocketGateway({ cors: { origin: '*' } })
export class MapaGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(MapaGateway.name);

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

  // Llamado desde MapaService.activarPatinando() después del upsert -- misma
  // forma que ya devuelve patinandoAhora(), así el frontend trata ambas
  // fuentes (carga inicial por REST, actualizaciones incrementales por
  // socket) con el mismo tipo.
  emitirUbicacion(payload: UbicacionEmitida) {
    this.server.emit('mapa:ubicacion', payload);
  }

  // Llamado desde MapaService.terminarPatinando() -- el frontend quita ese
  // miembro de la lista de "otros" de inmediato en vez de esperar a que
  // expire por vigencia (HORAS_VIGENCIA_PATINANDO).
  emitirDetencion(miembroId: number) {
    this.server.emit('mapa:detener', { miembroId });
  }
}
