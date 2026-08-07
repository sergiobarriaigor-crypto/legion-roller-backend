import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { borrarArchivoSubido } from '../common/uploads-fs.util';

const DIAS_VIGENCIA_VIDEO = 15;
// Si un job queda "procesando" más de esto sin actualizarse, asumimos que el
// backend se reinició a mitad del proceso (Railway redeployando) y lo
// marcamos como error -- sin reencolar automáticamente, mejor que el usuario
// reintente desde la UI.
const MIN_JOB_ATASCADO = 10;

@Injectable()
export class FlyoverLimpiezaScheduler {
  private readonly logger = new Logger(FlyoverLimpiezaScheduler.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgarVideosVencidos() {
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_VIGENCIA_VIDEO);

    const vencidos = await this.prisma.videoFlyover.findMany({
      where: { estado: 'listo', createdAt: { lte: limite } },
      select: { id: true, videoUrl: true },
    });

    for (const v of vencidos) {
      await borrarArchivoSubido(v.videoUrl);
      await this.prisma.videoFlyover.update({
        where: { id: v.id },
        data: {
          videoUrl: null,
          estado: 'error',
          errorMsg: 'Video vencido (más de 15 días)',
        },
      });
    }

    if (vencidos.length > 0) {
      this.logger.log(
        `Video(s) flyover vencido(s) purgado(s): ${vencidos.length}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async recuperarJobsAtascados() {
    const limite = new Date(Date.now() - MIN_JOB_ATASCADO * 60 * 1000);
    const atascados = await this.prisma.videoFlyover.findMany({
      where: { estado: 'procesando', actualizadoEn: { lt: limite } },
      select: { id: true },
    });

    for (const job of atascados) {
      await this.prisma.videoFlyover.update({
        where: { id: job.id },
        data: {
          estado: 'error',
          errorMsg: 'Proceso interrumpido (reinicio del servidor)',
        },
      });
    }

    if (atascados.length > 0) {
      this.logger.warn(
        `Job(s) flyover atascado(s) recuperado(s): ${atascados.length}`,
      );
    }
  }
}
