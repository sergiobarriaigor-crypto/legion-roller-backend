import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlyoverRenderService } from './flyover-render.service';
import type { EstiloFlyover } from './dto/solicitar-flyover.dto';

// Orquestación + cola en memoria (liviano, sin Puppeteer/ffmpeg acá -- ver
// FlyoverRenderService para el pipeline pesado). No hay Redis/Bull en el
// proyecto y no vale la pena introducirlo solo para esto: un único worker a
// la vez es más que suficiente para el volumen de un club.
@Injectable()
export class FlyoverService {
  private readonly logger = new Logger(FlyoverService.name);
  private colaIds: number[] = [];
  private procesando = false;

  constructor(
    private prisma: PrismaService,
    private renderService: FlyoverRenderService,
  ) {}

  async solicitarGeneracion(
    userId: number,
    recorridoId: number,
    estilo: EstiloFlyover = 'edificios',
  ) {
    const recorrido = await this.prisma.recorrido.findUnique({
      where: { id: recorridoId },
    });
    if (!recorrido) throw new NotFoundException('Recorrido no encontrado');
    if (recorrido.miembroId !== userId) {
      throw new ForbiddenException(
        'No podés generar el video de la ruta de otro miembro',
      );
    }

    // Si ya hay un job en curso para esta ruta, devolverlo tal cual en vez
    // de duplicar trabajo.
    const enCurso = await this.prisma.videoFlyover.findFirst({
      where: { recorridoId, estado: { in: ['pendiente', 'procesando'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (enCurso) return enCurso;

    const nuevo = await this.prisma.videoFlyover.create({
      data: { recorridoId, miembroId: userId, estado: 'pendiente', estilo },
    });
    this.encolar(nuevo.id);
    return nuevo;
  }

  async estadoPorId(id: number, userId: number) {
    const video = await this.prisma.videoFlyover.findUnique({ where: { id } });
    if (!video) throw new NotFoundException('Video no encontrado');
    if (video.miembroId !== userId) throw new ForbiddenException();
    return video;
  }

  async estadoPorRecorrido(recorridoId: number, userId: number) {
    const recorrido = await this.prisma.recorrido.findUnique({
      where: { id: recorridoId },
    });
    if (!recorrido || recorrido.miembroId !== userId) {
      throw new ForbiddenException();
    }
    return this.prisma.videoFlyover.findFirst({
      where: { recorridoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private encolar(id: number) {
    this.colaIds.push(id);
    this.tickCola();
  }

  private tickCola() {
    if (this.procesando) return;
    const siguienteId = this.colaIds.shift();
    if (siguienteId === undefined) return;
    this.procesando = true;
    this.renderService
      .procesarJob(siguienteId)
      .catch((err) =>
        this.logger.error(
          `Job flyover ${siguienteId} falló fuera del catch interno`,
          err,
        ),
      )
      .finally(() => {
        this.procesando = false;
        this.tickCola();
      });
  }
}
