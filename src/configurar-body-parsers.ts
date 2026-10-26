import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';

// Límite por defecto de TODOS los endpoints: el mismo que Nest/Express ya
// aplicaban (102400 bytes). No se sube en ningún otro lado.
export const LIMITE_BODY_DEFECTO = '100kb';

// Único endpoint con un límite mayor: el resumen diagnóstico GPS V2. Con la
// instrumentación de "tres relojes" el cuerpo de una corrida de ~30 min se
// acerca al límite por defecto, y un 413 aquí descartaría TODO el
// diagnóstico de la ruta.
export const RUTA_COMPARACION_V2 = '/mapa/recorridos/:id/comparacion-v2';
export const LIMITE_BODY_COMPARACION_V2 = '300kb';

interface ErrorDeParser {
  type?: string;
  status?: number;
  limit?: number;
  length?: number;
}

// Debe llamarse con `NestFactory.create(AppModule, { bodyParser: false })`:
// así Nest no registra sus parsers globales y el orden queda explícito
// (primero el de la ruta con límite mayor, después los globales; un cuerpo
// ya parseado no se vuelve a parsear).
export function configurarBodyParsers(app: NestExpressApplication): void {
  const logger = new Logger('BodyParser');

  app.use(RUTA_COMPARACION_V2, json({ limit: LIMITE_BODY_COMPARACION_V2 }));
  app.use(json({ limit: LIMITE_BODY_DEFECTO }));
  app.use(urlencoded({ extended: true, limit: LIMITE_BODY_DEFECTO }));

  // Un 413 NO debe pasar en silencio: queda en el log del servidor (con
  // tamaños, sin el contenido del cuerpo) y la respuesta lo explica.
  app.use(
    (err: ErrorDeParser, req: Request, res: Response, next: NextFunction) => {
      if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        logger.error(
          `413 ${req.method} ${req.path}: cuerpo de ${err.length ?? 'tamaño desconocido'} bytes supera el límite de ${err.limit ?? 'límite desconocido'} bytes (content-length=${req.headers['content-length'] ?? 'n/d'})`,
        );
        res.status(413).json({
          statusCode: 413,
          error: 'Payload Too Large',
          message: 'El cuerpo de la petición supera el límite permitido.',
          limiteBytes: err.limit ?? null,
          recibidoBytes: err.length ?? null,
        });
        return;
      }
      next(err);
    },
  );
}
