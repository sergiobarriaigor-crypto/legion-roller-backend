import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { borrarArchivoSubido } from '../common/uploads-fs.util';

// La foto de apoyo visual de una actividad se borra 15 días después de la
// FECHA DEL EVENTO (no de cuándo se creó) — la actividad se queda en el
// calendario/historial igual, solo desaparece la imagen.
const DIAS_VIGENCIA_FOTO = 15;

@Injectable()
export class CalendarioLimpiezaScheduler {
  private readonly logger = new Logger(CalendarioLimpiezaScheduler.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgarFotosVencidas() {
    const limite = new Date();
    limite.setDate(limite.getDate() - DIAS_VIGENCIA_FOTO);
    const pad = (n: number) => String(n).padStart(2, '0');
    const limiteStr = `${limite.getFullYear()}-${pad(limite.getMonth() + 1)}-${pad(limite.getDate())}`;

    const vencidas = await this.prisma.actividadCalendario.findMany({
      where: { fecha: { lte: limiteStr }, fotoUrl: { not: null } },
      select: { id: true, fotoUrl: true },
    });

    for (const actividad of vencidas) {
      await borrarArchivoSubido(actividad.fotoUrl);
      await this.prisma.actividadCalendario.update({
        where: { id: actividad.id },
        data: { fotoUrl: null, musicaId: null },
      });
    }

    if (vencidas.length > 0) {
      this.logger.log(
        `Fotos de ${vencidas.length} actividad(es) vencidas borradas`,
      );
    }
  }
}
