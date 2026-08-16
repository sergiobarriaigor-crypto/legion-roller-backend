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

function salaMiembro(miembroId: number) {
  return `emergencia-miembro-${miembroId}`;
}

// Ajuste post-diseño "aviso por cercanía": la ACTIVACIÓN de un SOS ya no es
// broadcast global -- EmergenciasService.activar() calcula qué miembros
// están patinando dentro del radio de ayuda y pasa esa lista acá, para
// avisar solo a quienes de verdad podrían llegar a ayudar. El resto de los
// miembros igual termina viendo el SOS en el mapa (sigue sin filtrarse por
// modo oculto ni por cercanía ahí -- ver comentario en
// mapa.service.ts/patinandoAhora), solo que por la vía más lenta: el
// polling de respaldo de EmergenciaContext.tsx (cada 45s). Mismo patrón que
// ChatGateway.emitir() (salas personales + this.server.to(salas).emit).
// La CANCELACIÓN sí sigue siendo broadcast global: cualquiera pudo haber
// visto el SOS por el polling de respaldo, así que todos necesitan enterarse
// rápido de que ya se resolvió.
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
      void client.join(salaMiembro(payload.sub));
    } catch {
      this.logger.warn('Conexión de socket rechazada: token inválido');
      client.disconnect();
    }
  }

  // Llamados desde EmergenciasService.activar()/cancelar() después de
  // escribir en la base -- el polling a /emergencias/activas (ver
  // EmergenciaContext.tsx) queda solo como respaldo de reconciliación.
  emitirActivacion(miembroId: number, destinatarios: number[]) {
    if (destinatarios.length === 0) return;
    this.server
      .to(destinatarios.map(salaMiembro))
      .emit('emergencia:activada', { miembroId });
  }

  emitirCancelacion(miembroId: number) {
    this.server.emit('emergencia:cancelada', { miembroId });
  }
}
