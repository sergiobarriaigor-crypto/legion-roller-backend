import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesPushService } from '../notificaciones-push/notificaciones-push.service';
import {
  calcularKeyframes,
  duracionSegDeKeyframes,
  FLYOVER_FPS,
  type PuntoGps,
} from './render/geo-flyover.util';

const execFileAsync = promisify(execFile);

// Funciones puente que render.html expone en `window` (ver ese archivo) --
// tipadas acá para evitar `any` al llamarlas desde page.evaluate.
interface VentanaRenderFlyover extends Window {
  __dibujarRuta: (geojson: unknown) => void;
  __jumpTo: (keyframe: unknown) => Promise<void>;
}

// Bajado de 720x1280 -- un error real visto en producción ("WebGL:
// INVALID_OPERATION... object does not belong to this context", "too many
// errors") es la firma típica de que el proceso de GPU (software, sin
// hardware real en Railway) se queda sin memoria y se reinicia a mitad de
// un video de 192 cuadros, dejando huérfanos los objetos WebGL de la
// sesión anterior. Menos píxeles por cuadro = menos memoria de video por
// cuadro. Sigue siendo perfectamente nítido para compartir en redes.
const ANCHO_VIDEO = 540;
const ALTO_VIDEO = 960;
// Timeout generoso para que la página cargue MapLibre + el estilo de
// OpenFreeMap -- en el smoke-test de Railway (ver plan) hay que confirmar
// que el software-rendering de WebGL no lo haga tardar más de esto.
const TIMEOUT_CARGA_MS = 30_000;
// Sin esto, un tile de terreno (AWS Terrain Tiles, ver render.html) que se
// cuelga sin responder deja el job trabado en "procesando" para siempre --
// map.once('idle') dentro de __jumpTo() nunca se resuelve, y no hay ningún
// límite de tiempo por cuadro que lo saque de ahí. AWS Terrain Tiles es un
// servicio gratuito sin SLA (ver ESTILO_SATELITAL en render.html): un tile
// puntual puede reintentar internamente antes de fallar (404) o de que
// MapLibre siga sin él -- 25s (subido de 15s tras un caso real con un
// cuadro que tardó justo eso) da más margen a esos reintentos sin dejar de
// garantizar que el job eventualmente termine en error en vez de quedar
// colgado sin avisar ni permitir reintentar.
const TIMEOUT_FRAME_MS = 25_000;
// Red de seguridad para la codificación de ffmpeg -- ver -preset ultrafast
// más abajo para el fix real (CPU/memoria), esto es solo para que un
// cuelgue por otra causa termine en error en vez de para siempre.
const TIMEOUT_FFMPEG_MS = 3 * 60 * 1000;

@Injectable()
export class FlyoverRenderService {
  private readonly logger = new Logger(FlyoverRenderService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesPushService: NotificacionesPushService,
  ) {}

  async procesarJob(videoFlyoverId: number): Promise<void> {
    let dirTemporal: string | null = null;
    try {
      await this.prisma.videoFlyover.update({
        where: { id: videoFlyoverId },
        data: { estado: 'procesando' },
      });

      const job = await this.prisma.videoFlyover.findUniqueOrThrow({
        where: { id: videoFlyoverId },
        include: { recorrido: true },
      });
      const puntos = JSON.parse(job.recorrido.puntos) as PuntoGps[];
      if (puntos.length < 2) {
        throw new Error('El recorrido no tiene suficientes puntos GPS');
      }

      const keyframes = calcularKeyframes(puntos, job.recorrido.distanciaKm);
      dirTemporal = await fs.mkdtemp(
        join(tmpdir(), `flyover-${videoFlyoverId}-`),
      );

      await this.capturarFrames(puntos, keyframes, dirTemporal, job.estilo);

      const nombreArchivo = `${Date.now()}-${Math.round(Math.random() * 1e9)}.mp4`;
      const rutaFinal = join(process.cwd(), 'uploads', nombreArchivo);
      await this.codificarVideo(dirTemporal, rutaFinal);

      const base = process.env.URL_PUBLICA_BACKEND ?? 'http://localhost:4000';
      const videoUrl = `${base}/uploads/${nombreArchivo}`;
      const duracionSeg = duracionSegDeKeyframes(keyframes);

      await this.prisma.videoFlyover.update({
        where: { id: videoFlyoverId },
        data: { estado: 'listo', videoUrl, duracionSeg },
      });

      await this.notificacionesPushService.enviarAMiembros([job.miembroId], {
        titulo: 'Tu video 3D está listo 🎬',
        cuerpo: 'Tu ruta ya tiene un video para compartir.',
        url: '/mapa',
      });
    } catch (err) {
      this.logger.error(
        `Job flyover ${videoFlyoverId} falló`,
        err instanceof Error ? err.stack : err,
      );
      await this.prisma.videoFlyover
        .update({
          where: { id: videoFlyoverId },
          data: {
            estado: 'error',
            errorMsg: String(err instanceof Error ? err.message : err),
          },
        })
        .catch(() => {});
    } finally {
      if (dirTemporal) {
        await fs
          .rm(dirTemporal, { recursive: true, force: true })
          .catch(() => {});
      }
    }
  }

  private async capturarFrames(
    puntos: PuntoGps[],
    keyframes: ReturnType<typeof calcularKeyframes>,
    dirTemporal: string,
    estilo: string,
  ): Promise<void> {
    const puerto = process.env.PORT ?? 4000;
    const navegador = await puppeteer.launch({
      headless: true,
      // Railway no tiene GPU -- estos flags fuerzan WebGL por software
      // (ANGLE + SwiftShader). Chrome dejó de habilitar el fallback a
      // SwiftShader automáticamente (queda como warning en consola:
      // "Automatic fallback to software WebGL has been deprecated") -- sin
      // --enable-unsafe-swiftshader, WebGL nunca termina de inicializar y
      // el mapa jamás pinta nada, colgando el cuadro 0 para siempre (era
      // la causa real detrás de todos los intentos fallidos anteriores,
      // no el pitch/zoom ni el terreno específicamente).
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    // Diagnóstico: un timeout esperando window.__mapaListo no dice POR QUÉ
    // (¿WebGL falló al iniciar? ¿no llegó a unpkg.com/openfreemap.org desde
    // Railway? ¿otra excepción de JS?) -- se junta consola + errores de
    // página + requests fallidos de la página para poder verlo en errorMsg
    // sin necesitar acceso a los logs de Railway.
    const diagnostico: string[] = [];

    try {
      const page = await navegador.newPage();
      page.on('console', (msg) => {
        diagnostico.push(`console.${msg.type()}: ${msg.text()}`);
      });
      page.on('pageerror', (err: unknown) => {
        diagnostico.push(
          `pageerror: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
      page.on('requestfailed', (req) => {
        diagnostico.push(
          `requestfailed: ${req.url()} (${req.failure()?.errorText ?? 'sin detalle'})`,
        );
      });

      await page.setViewport({
        width: ANCHO_VIDEO,
        height: ALTO_VIDEO,
        deviceScaleFactor: 1,
      });
      await page.goto(
        `http://localhost:${puerto}/flyover-render/render.html?estilo=${encodeURIComponent(estilo)}`,
        { waitUntil: 'domcontentloaded', timeout: TIMEOUT_CARGA_MS },
      );
      await page.waitForFunction('window.__mapaListo === true', {
        timeout: TIMEOUT_CARGA_MS,
      });

      const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: puntos.map((p) => [p.lon, p.lat]),
        },
      };
      await page.evaluate(
        (g) => (window as unknown as VentanaRenderFlyover).__dibujarRuta(g),
        geojson,
      );

      for (let i = 0; i < keyframes.length; i++) {
        await this.conTimeout(
          page.evaluate(
            (kf) => (window as unknown as VentanaRenderFlyover).__jumpTo(kf),
            keyframes[i],
          ),
          TIMEOUT_FRAME_MS,
          `cuadro ${i}/${keyframes.length} tardó más de ${TIMEOUT_FRAME_MS / 1000}s (posible tile de terreno colgado)`,
        );
        const nombreFrame = `frame-${String(i).padStart(5, '0')}.png`;
        await page.screenshot({
          path: join(dirTemporal, nombreFrame),
        });
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      const detalle = diagnostico.slice(-10).join(' | ');
      throw new Error(
        detalle ? `${mensaje} -- diagnóstico: ${detalle}` : mensaje,
      );
    } finally {
      await navegador.close().catch(() => {});
    }
  }

  // page.evaluate() de por sí no tiene timeout propio cuando la promesa que
  // devuelve el navegador (acá, __jumpTo() esperando map.once('idle')) nunca
  // se resuelve -- Puppeteer solo aplica timeout a la EJECUCIÓN del script,
  // no a la promesa resultante. Sin este wrapper, un solo cuadro colgado
  // cuelga todo el job para siempre.
  private conTimeout<T>(
    promesa: Promise<T>,
    ms: number,
    mensajeTimeout: string,
  ): Promise<T> {
    return Promise.race([
      promesa,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(mensajeTimeout)), ms),
      ),
    ]);
  }

  private async codificarVideo(
    dirTemporal: string,
    rutaFinal: string,
  ): Promise<void> {
    // -preset ultrafast: sin esto, libx264 usaba el preset por defecto
    // ("medium"), que en el servidor sin GPU real de Railway codificaba a
    // ~0.08x tiempo real -- suficientemente lento como para agotar memoria
    // o CPU antes de terminar y que el proceso terminara matado sin dejar
    // ningún error explícito (solo el progreso cortado a mitad de camino).
    // El archivo final pesa un poco más a este preset, aceptable para un
    // video corto pensado para compartir en redes.
    await execFileAsync(ffmpegPath as string, [
      '-y',
      '-framerate',
      String(FLYOVER_FPS),
      '-i',
      join(dirTemporal, 'frame-%05d.png'),
      '-vf',
      `scale=${ANCHO_VIDEO}:${ALTO_VIDEO}`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      rutaFinal,
    ], { timeout: TIMEOUT_FFMPEG_MS });
  }
}
