import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Railway termina el HTTPS en su borde y reenvía la conexión al backend por
  // HTTP puertas adentro — sin esto, Express no confía en el encabezado
  // X-Forwarded-Proto y `req.protocol` siempre reporta "http", aunque el
  // usuario haya entrado por https. Eso hacía que TODAS las URLs de fotos
  // subidas (uploads.controller.ts) quedaran guardadas como http://, lo que
  // no se notaba en un <img> normal pero rompía en silencio cualquier
  // fetch() de esa foto (ej. "Compartir a redes" en Post/Impulsa), porque el
  // navegador bloquea ese fetch por ser contenido mixto (https pidiendo http).
  app.set('trust proxy', 1);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  // Página vanilla que carga Puppeteer para renderizar el video flyover 3D
  // (ver flyover-render.service.ts) -- servida por el propio backend porque
  // Puppeteer necesita algo 100% autocontenido en este proceso, sin depender
  // del despliegue aparte del frontend en Vercel.
  app.useStaticAssets(join(process.cwd(), 'public-flyover'), {
    prefix: '/flyover-render/',
  });
  // MapLibre GL JS v6 no publica un build UMD (global de script clásico),
  // solo módulos ES (.mjs) -- cargarlo desde un CDN (unpkg) con la URL del
  // build viejo devolvía 404, y Chrome bloqueaba esa respuesta como ORB.
  // Se sirve el paquete instalado en node_modules directo, sin depender de
  // ningún CDN externo para esto.
  app.useStaticAssets(join(process.cwd(), 'node_modules/maplibre-gl/dist'), {
    prefix: '/flyover-render/vendor/',
  });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
