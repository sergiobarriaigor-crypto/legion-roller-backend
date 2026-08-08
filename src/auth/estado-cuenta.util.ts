import { PrismaService } from '../prisma/prisma.service';

export interface EstadoCuenta {
  activa: boolean;
  motivo: string | null;
}

// Compartido entre JwtStrategy (requests HTTP) y los 3 gateways de socket
// (chat/historias/mapa, que decodifican su propio JWT sin pasar por
// Passport) -- un bloqueo o eliminación decidido por un admin debe cortar
// de inmediato cualquier sesión ya activa, no solo el próximo login.
export async function obtenerEstadoCuenta(
  prisma: PrismaService,
  miembroId: number,
): Promise<EstadoCuenta> {
  const miembro = await prisma.miembro.findUnique({
    where: { id: miembroId },
    select: { eliminadoEn: true, bloqueadoHasta: true, bloqueadoMotivo: true },
  });

  if (!miembro || miembro.eliminadoEn) {
    return { activa: false, motivo: 'Esta cuenta ya no existe.' };
  }

  if (miembro.bloqueadoHasta && miembro.bloqueadoHasta > new Date()) {
    const fecha = miembro.bloqueadoHasta.toLocaleString('es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const motivo = miembro.bloqueadoMotivo
      ? `: ${miembro.bloqueadoMotivo}`
      : '.';
    return {
      activa: false,
      motivo: `Tu cuenta está bloqueada hasta ${fecha}${motivo}`,
    };
  }

  return { activa: true, motivo: null };
}
