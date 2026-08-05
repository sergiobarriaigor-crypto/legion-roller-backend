// Feriados legales nacionales de Chile, calculados en vivo (no se guardan en
// la base de datos, igual que los cumpleaños en calendario.service.ts). No
// incluye feriados regionales (Arica, Chillán, etc.), solo los de todo el
// país.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fechaStr(anio: number, mes: number, dia: number): string {
  return `${anio}-${pad(mes)}-${pad(dia)}`;
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha.getTime());
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}

function aFechaStr(fecha: Date): string {
  return fechaStr(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth() + 1,
    fecha.getUTCDate(),
  );
}

// Algoritmo de Meeus/Jones/Butcher para el domingo de Pascua (calendario gregoriano).
function domingoPascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

// Ley 19.668: San Pedro y San Pablo y el Encuentro de Dos Mundos se celebran
// el día lunes más cercano a su fecha original.
function lunesMasCercano(fecha: Date): Date {
  const dow = fecha.getUTCDay();
  const aLunes = (1 - dow + 7) % 7;
  const desdeLunes = (dow - 1 + 7) % 7;
  return aLunes <= desdeLunes
    ? sumarDias(fecha, aLunes)
    : sumarDias(fecha, -desdeLunes);
}

const FERIADOS_FIJOS: { mes: number; dia: number; nombre: string }[] = [
  { mes: 1, dia: 1, nombre: 'Año Nuevo' },
  { mes: 5, dia: 1, nombre: 'Día Nacional del Trabajo' },
  { mes: 5, dia: 21, nombre: 'Día de las Glorias Navales' },
  { mes: 7, dia: 16, nombre: 'Virgen del Carmen' },
  { mes: 8, dia: 15, nombre: 'Asunción de la Virgen' },
  { mes: 9, dia: 18, nombre: 'Independencia Nacional' },
  { mes: 9, dia: 19, nombre: 'Día de las Glorias del Ejército' },
  { mes: 10, dia: 31, nombre: 'Iglesias Evangélicas y Protestantes' },
  { mes: 11, dia: 1, nombre: 'Día de Todos los Santos' },
  { mes: 12, dia: 8, nombre: 'Inmaculada Concepción' },
  { mes: 12, dia: 25, nombre: 'Navidad' },
];

// El decreto oficial fija esta fecha según el solsticio de invierno
// astronómico de cada año (Ley 21.357), no sigue una fórmula matemática fija.
// Tabla con los años ya decretados; 21 de junio como valor por defecto para
// años sin decreto todavía.
const DIA_PUEBLOS_INDIGENAS: Record<number, number> = {
  2021: 21,
  2022: 21,
  2023: 21,
  2024: 20,
  2025: 20,
  2026: 21,
  2027: 21,
};

export function feriadosDelAnio(
  anio: number,
): { fecha: string; nombre: string }[] {
  const feriados = FERIADOS_FIJOS.map((f) => ({
    fecha: fechaStr(anio, f.mes, f.dia),
    nombre: f.nombre,
  }));

  const pascua = domingoPascua(anio);
  feriados.push({
    fecha: aFechaStr(sumarDias(pascua, -2)),
    nombre: 'Viernes Santo',
  });
  feriados.push({
    fecha: aFechaStr(sumarDias(pascua, -1)),
    nombre: 'Sábado Santo',
  });

  const diaIndigenas = DIA_PUEBLOS_INDIGENAS[anio] ?? 21;
  feriados.push({
    fecha: fechaStr(anio, 6, diaIndigenas),
    nombre: 'Día Nacional de los Pueblos Indígenas',
  });

  feriados.push({
    fecha: aFechaStr(lunesMasCercano(new Date(Date.UTC(anio, 5, 29)))),
    nombre: 'San Pedro y San Pablo',
  });
  feriados.push({
    fecha: aFechaStr(lunesMasCercano(new Date(Date.UTC(anio, 9, 12)))),
    nombre: 'Encuentro de Dos Mundos',
  });

  return feriados.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function feriadosDelMes(
  anio: number,
  mes: number,
): { fecha: string; nombre: string }[] {
  const prefijo = `${anio}-${pad(mes)}-`;
  return feriadosDelAnio(anio).filter((f) => f.fecha.startsWith(prefijo));
}
