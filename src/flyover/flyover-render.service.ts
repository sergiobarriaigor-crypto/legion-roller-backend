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

const ANCHO_VIDEO = 720;
const ALTO_VIDEO = 1280;
// Timeout generoso para que la página cargue MapLibre + el estilo de
// OpenFreeMap -- en el smoke-test de Railway (ver plan) hay que confirmar
// que el software-rendering de WebGL no lo haga tardar más de esto.
const TIMEOUT_CARGA_MS = 30_000;

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

      await this.capturarFrames(puntos, keyframes, dirTemporal);

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
  ): Promise<void> {
    const puerto = process.env.PORT ?? 4000;
    const navegador = await puppeteer.launch({
      headless: true,
      // Railway no tiene GPU -- estos flags fuerzan WebGL por software
      // (ANGLE + SwiftShader). Confirmar/ajustar en el smoke-test real de
      // Railway (ver plan): puede requerir --use-gl=swiftshader a secas, o
      // que falten libs de Mesa en la imagen del contenedor.
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    try {
      const page = await navegador.newPage();
      await page.setViewport({
        width: ANCHO_VIDEO,
        height: ALTO_VIDEO,
        deviceScaleFactor: 1,
      });
      await page.goto(`http://localhost:${puerto}/flyover-render/render.html`, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_CARGA_MS,
      });
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
        await page.evaluate(
          (kf) => (window as unknown as VentanaRenderFlyover).__jumpTo(kf),
          keyframes[i],
        );
        const nombreFrame = `frame-${String(i).padStart(5, '0')}.png`;
        await page.screenshot({
          path: join(dirTemporal, nombreFrame),
        });
      }
    } finally {
      await navegador.close().catch(() => {});
    }
  }

  private async codificarVideo(
    dirTemporal: string,
    rutaFinal: string,
  ): Promise<void> {
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
      '-pix_fmt',
      'yuv420p',
      rutaFinal,
    ]);
  }
}
