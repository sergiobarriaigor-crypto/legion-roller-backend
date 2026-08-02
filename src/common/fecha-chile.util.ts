// Combina fecha+hora ("YYYY-MM-DD" + "HH:MM", como se guardan en Publicacion)
// asumiendo SIEMPRE hora de Chile (America/Santiago) — sin importar en qué
// zona horaria corra el proceso de Node. Antes cada módulo (mapa.service.ts,
// publicaciones.service.ts, recordatorios.scheduler.ts) tenía su propio
// combinarFechaHora() con `new Date(fecha+"T"+hora)`, que interpreta la
// cadena como hora LOCAL DEL SERVIDOR — en Railway eso es UTC por defecto (o
// depende de que la variable TZ esté puesta Y que la imagen tenga los datos
// de zona horaria instalados, algo que no se puede garantizar). Usar
// Intl.DateTimeFormat evita esa dependencia: la tabla de zonas horarias viene
// incluida en el propio Node (ICU), no en el sistema operativo del contenedor.
const ZONA_CHILE = 'America/Santiago';

export function combinarFechaHoraChile(
  fecha: string | null,
  hora: string | null,
): Date | null {
  if (!fecha) return null;
  const horaFinal = hora ?? '00:00';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const matchHora = /^(\d{2}):(\d{2})$/.exec(horaFinal);
  if (!match || !matchHora) return null;
  const [, anio, mes, dia] = match;
  const [, horas, minutos] = matchHora;

  // 1) Se arma un instante de referencia tratando esos mismos números como si
  //    fueran UTC (no representa la hora real todavía, es solo el punto de
  //    partida para medir el desfase de la zona horaria en esa fecha puntual
  //    — importa porque el horario de verano cambia el desfase según la
  //    época del año).
  const comoUtc = Date.UTC(
    Number(anio),
    Number(mes) - 1,
    Number(dia),
    Number(horas),
    Number(minutos),
    0,
  );
  if (Number.isNaN(comoUtc)) return null;

  // 2) Se pregunta qué hora "ve" Santiago en ese instante de referencia.
  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_CHILE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const partes = Object.fromEntries(
    formateador.formatToParts(new Date(comoUtc)).map((p) => [p.type, p.value]),
  );
  const vistoDesdeSantiago = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );

  // 3) La diferencia entre lo que se pidió (comoUtc) y lo que Santiago "ve"
  //    en ese instante es el desfase real de la zona horaria en esa fecha
  //    (incluye horario de verano si corresponde). Se aplica ese desfase
  //    sobre la referencia para obtener el instante UTC real.
  const desfaseMs = comoUtc - vistoDesdeSantiago;
  return new Date(comoUtc + desfaseMs);
}
