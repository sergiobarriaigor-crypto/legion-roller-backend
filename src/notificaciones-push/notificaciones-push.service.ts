import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import {
  getApps,
  initializeApp,
  cert,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import { PushSuscripcionDto } from './dto/push-suscripcion.dto';

interface PayloadPush {
  titulo: string;
  cuerpo: string;
  url?: string;
}

// Debe coincidir con CANAL_ALERTAS en frontend/src/lib/pushNativo.ts, que
// crea este canal en el dispositivo con importancia máxima -- sin decirle
// a FCM que use ese canal, Android manda la notificación al canal por
// defecto (importancia media) y no aparece emergente ni en pantalla de
// bloqueo con el contenido visible.
const CANAL_ALERTAS_ANDROID = 'legion_alertas';

// Logo ya publicado en el frontend (frontend/public/logo-legion-roller-mini.png).
// Android lo usa como ícono grande (junto al texto) y como imagen expandida
// al abrir la notificación -- el ícono chico de la barra de estado sigue
// siendo el monocromo (ic_stat_notify) que exige Android, este es aparte.
const LOGO_NOTIFICACION_URL =
  'https://legion-roller-front.vercel.app/logo-legion-roller-mini.png';

@Injectable()
export class NotificacionesPushService {
  private readonly logger = new Logger(NotificacionesPushService.name);

  constructor(private prisma: PrismaService) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:admin@legionroller.local',
      process.env.VAPID_PUBLIC_KEY ?? '',
      process.env.VAPID_PRIVATE_KEY ?? '',
    );

    // Push nativo (app Android vía Capacitor) usa Firebase Cloud Messaging,
    // un mecanismo de envío totalmente aparte de Web Push/VAPID de arriba.
    // FIREBASE_SERVICE_ACCOUNT_JSON contiene el contenido completo del
    // archivo de cuenta de servicio (descargado desde Firebase Console >
    // Configuración del proyecto > Cuentas de servicio > Generar nueva
    // clave privada) como una sola variable de entorno -- nunca se commitea
    // al repo, es una credencial con permiso para enviar push a cualquier
    // dispositivo del proyecto. Si no está configurada, se omite el envío
    // nativo en silencio (mismo criterio que las VAPID keys vacías arriba)
    // en vez de tumbar el arranque del backend.
    if (!getApps().length) {
      const credencialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (credencialJson) {
        try {
          initializeApp({
            credential: cert(JSON.parse(credencialJson) as ServiceAccount),
          });
        } catch (err) {
          this.logger.warn(`No se pudo inicializar Firebase Admin: ${err}`);
        }
      } else {
        this.logger.warn(
          'FIREBASE_SERVICE_ACCOUNT_JSON no configurada -- el push nativo (app Android) está desactivado.',
        );
      }
    }
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

  // Registra (o refresca) el token FCM de un dispositivo Android nativo. Un
  // mismo token puede reasignarse a otro miembro (reinstalación, logout +
  // login con otra cuenta en el mismo teléfono) -- upsert por token, igual
  // criterio que guardarSuscripcion() por endpoint.
  async guardarTokenNativo(miembroId: number, token: string) {
    await this.prisma.tokenPushNativo.upsert({
      where: { token },
      create: { miembroId, token },
      update: { miembroId },
    });
    return { mensaje: 'Token nativo guardado' };
  }

  async eliminarTokenNativo(token: string) {
    await this.prisma.tokenPushNativo.deleteMany({ where: { token } });
    return { mensaje: 'Token nativo eliminado' };
  }

  // Envía el push a todos los dispositivos suscritos (broadcast a "todos los
  // usuarios de la Legión", sin filtrar por RSVP/interés).
  async enviarATodos(payload: PayloadPush) {
    const [suscripciones, tokensNativos] = await Promise.all([
      this.prisma.suscripcionPush.findMany(),
      this.prisma.tokenPushNativo.findMany(),
    ]);
    await Promise.all([
      this.enviarASuscripciones(suscripciones, payload),
      this.enviarATokensNativos(
        tokensNativos.map((t) => t.token),
        payload,
      ),
    ]);
  }

  // Envía el push solo a los dispositivos de los miembros indicados (ver
  // RecordatoriosScheduler: solo quienes respondieron "Voy"/"Tal vez").
  async enviarAMiembros(miembroIds: number[], payload: PayloadPush) {
    if (miembroIds.length === 0) return;
    const [suscripciones, tokensNativos] = await Promise.all([
      this.prisma.suscripcionPush.findMany({
        where: { miembroId: { in: miembroIds } },
      }),
      this.prisma.tokenPushNativo.findMany({
        where: { miembroId: { in: miembroIds } },
      }),
    ]);
    await Promise.all([
      this.enviarASuscripciones(suscripciones, payload),
      this.enviarATokensNativos(
        tokensNativos.map((t) => t.token),
        payload,
      ),
    ]);
  }

  // Si Firebase Admin no quedó inicializado (sin FIREBASE_SERVICE_ACCOUNT_JSON
  // configurada), se omite en silencio -- mismo criterio que las VAPID keys
  // vacías arriba, no debe tumbar el resto del envío (Web Push).
  private async enviarATokensNativos(tokens: string[], payload: PayloadPush) {
    if (tokens.length === 0 || !getApps().length) return;

    try {
      const respuesta = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.titulo, body: payload.cuerpo },
        data: payload.url ? { url: payload.url } : undefined,
        android: {
          priority: 'high',
          notification: {
            channelId: CANAL_ALERTAS_ANDROID,
            priority: 'max',
            visibility: 'public',
            imageUrl: LOGO_NOTIFICACION_URL,
          },
        },
      });

      const tokensInvalidos: string[] = [];
      respuesta.responses.forEach((r, i) => {
        if (!r.success && r.error) {
          const codigo = r.error.code;
          if (
            codigo === 'messaging/registration-token-not-registered' ||
            codigo === 'messaging/invalid-registration-token'
          ) {
            tokensInvalidos.push(tokens[i]);
          } else {
            this.logger.warn(
              `Error enviando push nativo a ${tokens[i]}: ${r.error.message}`,
            );
          }
        }
      });
      if (tokensInvalidos.length > 0) {
        await this.prisma.tokenPushNativo.deleteMany({
          where: { token: { in: tokensInvalidos } },
        });
      }
    } catch (err) {
      this.logger.warn(`Error enviando push nativo (FCM): ${err}`);
    }
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
