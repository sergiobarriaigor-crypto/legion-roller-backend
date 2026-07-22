import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushSuscripcionDto } from './dto/push-suscripcion.dto';

interface PayloadPush {
  titulo: string;
  cuerpo: string;
  url?: string;
}

@Injectable()
export class NotificacionesPushService {
  private readonly logger = new Logger(NotificacionesPushService.name);

  constructor(private prisma: PrismaService) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:admin@legionroller.local',
      process.env.VAPID_PUBLIC_KEY ?? '',
      process.env.VAPID_PRIVATE_KEY ?? '',
    );
  }

  async guardarSuscripcion(miembroId: number, dto: PushSuscripcionDto) {
    await this.prisma.suscripcionPush.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        miembroId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
      update: {
        miembroId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
      },
    });
    return { mensaje: 'Suscripción guardada' };
  }

  async eliminarSuscripcion(endpoint: string) {
    await this.prisma.suscripcionPush.deleteMany({ where: { endpoint } });
    return { mensaje: 'Suscripción eliminada' };
  }

  // Envía el push a todos los dispositivos suscritos (broadcast a "todos los
  // usuarios de la Legión", sin filtrar por RSVP/interés).
  async enviarATodos(payload: PayloadPush) {
    const suscripciones = await this.prisma.suscripcionPush.findMany();
    await this.enviarASuscripciones(suscripciones, payload);
  }

  // Envía el push solo a los dispositivos de los miembros indicados (ver
  // RecordatoriosScheduler: solo quienes respondieron "Voy"/"Tal vez").
  async enviarAMiembros(miembroIds: number[], payload: PayloadPush) {
    if (miembroIds.length === 0) return;
    const suscripciones = await this.prisma.suscripcionPush.findMany({
      where: { miembroId: { in: miembroIds } },
    });
    await this.enviarASuscripciones(suscripciones, payload);
  }

  // Si un endpoint ya no es válido (dispositivo desinstaló la app / permiso
  // revocado), web-push responde 404/410 y se limpia esa fila (patrón
  // estándar de la librería).
  private async enviarASuscripciones(
    suscripciones: { endpoint: string; p256dh: string; auth: string }[],
    payload: PayloadPush,
  ) {
    const cuerpo = JSON.stringify(payload);

    await Promise.all(
      suscripciones.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            cuerpo,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.eliminarSuscripcion(s.endpoint);
          } else {
            this.logger.warn(`Error enviando push a ${s.endpoint}: ${err}`);
          }
        }
      }),
    );
  }
}
