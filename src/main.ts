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
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
