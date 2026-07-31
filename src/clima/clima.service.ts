import { Injectable, Logger } from '@nestjs/common';

export interface HoraClima {
  hora: string;
  temperatura: number;
  icono: string;
  probabilidadLluvia: number;
  vientoVelocidad: number;
}

export interface DiaClima {
  fecha: string;
  tempMax: number;
  tempMin: number;
  icono: string;
  descripcion: string;
  probabilidadLluvia: number;
}

export type SemaforoClima = 'bueno' | 'precaucion' | 'no_recomendado';

export interface ClimaDetalle {
  lat: number;
  lon: number;
  temperatura: number;
  sensacionTermica: number;
  icono: string;
  descripcion: string;
  probabilidadLluvia: number;
  vientoVelocidad: number;
  vientoDireccion: string;
  semaforo: SemaforoClima;
  proximasHoras: HoraClima[];
  proximosDias: DiaClima[];
  historialDias: DiaClima[];
  actualizadoEn: string;
}

const TTL_MS = 30 * 60 * 1000;
const DIAS_HISTORIAL = 3;
const DIAS_PRONOSTICO = 3;
const HORAS_PRONOSTICO = 12;

// Mapeo simplificado de códigos WMO (weather_code de Open-Meteo) a ícono +
// descripción — no cubre cada código posible, solo los rangos relevantes
// para el clima de la zona (sección 7.7.1 de https://open-meteo.com/en/docs).
function mapearCodigo(codigo: number): { icono: string; descripcion: string } {
  if (codigo === 0) return { icono: '☀️', descripcion: 'Despejado' };
  if (codigo <= 2) return { icono: '🌤️', descripcion: 'Parcialmente nublado' };
  if (codigo === 3) return { icono: '☁️', descripcion: 'Nublado' };
  if (codigo === 45 || codigo === 48)
    return { icono: '🌫️', descripcion: 'Niebla' };
  if (codigo >= 51 && codigo <= 57)
    return { icono: '🌦️', descripcion: 'Llovizna' };
  if (codigo >= 61 && codigo <= 67)
    return { icono: '🌧️', descripcion: 'Lluvia' };
  if (codigo >= 71 && codigo <= 77)
    return { icono: '❄️', descripcion: 'Nieve' };
  if (codigo >= 80 && codigo <= 82)
    return { icono: '🌧️', descripcion: 'Chubascos' };
  if (codigo >= 95) return { icono: '⛈️', descripcion: 'Tormenta eléctrica' };
  return { icono: '🌥️', descripcion: 'Variable' };
}

function direccionViento(grados: number): string {
  const puntos = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return puntos[Math.round(grados / 45) % 8];
}

// Regla simple para patinadores: lluvia activa/fuerte o viento fuerte
// desaconsejan salir; llovizna/niebla o viento moderado piden precaución.
// Se puede afinar más adelante si la experiencia real lo pide.
function calcularSemaforo(
  codigo: number,
  probabilidadLluvia: number,
  vientoVelocidad: number,
): SemaforoClima {
  const lluviaFuerte =
    (codigo >= 61 && codigo <= 67) ||
    (codigo >= 80 && codigo <= 82) ||
    codigo >= 95;
  const lluviaLigera =
    codigo === 45 || codigo === 48 || (codigo >= 51 && codigo <= 57);
  if (lluviaFuerte || probabilidadLluvia >= 60 || vientoVelocidad >= 40) {
    return 'no_recomendado';
  }
  if (lluviaLigera || probabilidadLluvia >= 30 || vientoVelocidad >= 20) {
    return 'precaucion';
  }
  return 'bueno';
}

interface RespuestaOpenMeteo {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
}

// Caché en memoria por coordenada redondeada (~1km) — mismo criterio ya
// usado por ChatPresenceService/VerificacionCorreoService para estado
// efímero sin tabla nueva en la base.
@Injectable()
export class ClimaService {
  private readonly logger = new Logger(ClimaService.name);
  private cache = new Map<string, ClimaDetalle>();

  private vigente(entrada: ClimaDetalle | undefined): entrada is ClimaDetalle {
    if (!entrada) return false;
    return Date.now() - new Date(entrada.actualizadoEn).getTime() < TTL_MS;
  }

  async obtener(lat: number, lon: number): Promise<ClimaDetalle> {
    const clave = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cacheada = this.cache.get(clave);
    if (this.vigente(cacheada)) return cacheada;

    try {
      const entrada = await this.consultarOpenMeteo(lat, lon);
      this.cache.set(clave, entrada);
      return entrada;
    } catch (err) {
      this.logger.warn(
        `No se pudo obtener el clima de ${clave}: ${(err as Error).message}`,
      );
      // Mejor un dato viejo que nada; solo se propaga el error si nunca hubo dato.
      if (cacheada) return cacheada;
      throw err;
    }
  }

  private async consultarOpenMeteo(
    lat: number,
    lon: number,
  ): Promise<ClimaDetalle> {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=auto&past_days=${DIAS_HISTORIAL}&forecast_days=${DIAS_PRONOSTICO + 1}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo respondió ${res.status}`);
    }
    const datos = (await res.json()) as RespuestaOpenMeteo;

    const { icono, descripcion } = mapearCodigo(datos.current.weather_code);
    // current.time viene con minutos (ej. "10:15", intervalo de 15 min),
    // pero hourly.time solo tiene marcas en punto ("10:00") — comparar tal
    // cual nunca coincidía y dejaba proximasHoras siempre vacío. Se redondea
    // hacia abajo a la hora en punto antes de buscar el índice.
    const horaActualEnPunto = `${datos.current.time.slice(0, 13)}:00`;
    const indiceHoraActual = datos.hourly.time.findIndex(
      (t) => t === horaActualEnPunto,
    );
    const probabilidadLluviaActual =
      indiceHoraActual >= 0
        ? datos.hourly.precipitation_probability[indiceHoraActual]
        : 0;

    const proximasHoras: HoraClima[] = (
      indiceHoraActual >= 0
        ? datos.hourly.time.slice(
            indiceHoraActual + 1,
            indiceHoraActual + 1 + HORAS_PRONOSTICO,
          )
        : []
    ).map((hora, i) => {
      const idx = indiceHoraActual + 1 + i;
      return {
        hora,
        temperatura: Math.round(datos.hourly.temperature_2m[idx]),
        icono: mapearCodigo(datos.hourly.weather_code[idx]).icono,
        probabilidadLluvia: datos.hourly.precipitation_probability[idx],
        vientoVelocidad: Math.round(datos.hourly.wind_speed_10m[idx]),
      };
    });

    // daily.time va de (hoy - DIAS_HISTORIAL) a (hoy + DIAS_PRONOSTICO):
    // los primeros DIAS_HISTORIAL son historial, el índice DIAS_HISTORIAL es
    // hoy (ya cubierto por "current") y el resto es el pronóstico.
    const construirDia = (idx: number): DiaClima => ({
      fecha: datos.daily.time[idx],
      tempMax: Math.round(datos.daily.temperature_2m_max[idx]),
      tempMin: Math.round(datos.daily.temperature_2m_min[idx]),
      icono: mapearCodigo(datos.daily.weather_code[idx]).icono,
      descripcion: mapearCodigo(datos.daily.weather_code[idx]).descripcion,
      probabilidadLluvia: datos.daily.precipitation_probability_max[idx],
    });
    const historialDias: DiaClima[] = [];
    for (let i = 0; i < DIAS_HISTORIAL; i++)
      historialDias.push(construirDia(i));
    const proximosDias: DiaClima[] = [];
    for (let i = 1; i <= DIAS_PRONOSTICO; i++) {
      proximosDias.push(construirDia(DIAS_HISTORIAL + i));
    }

    return {
      lat,
      lon,
      temperatura: Math.round(datos.current.temperature_2m),
      sensacionTermica: Math.round(datos.current.apparent_temperature),
      icono,
      descripcion,
      probabilidadLluvia: probabilidadLluviaActual,
      vientoVelocidad: Math.round(datos.current.wind_speed_10m),
      vientoDireccion: direccionViento(datos.current.wind_direction_10m),
      semaforo: calcularSemaforo(
        datos.current.weather_code,
        probabilidadLluviaActual,
        datos.current.wind_speed_10m,
      ),
      proximasHoras,
      proximosDias,
      historialDias,
      actualizadoEn: new Date().toISOString(),
    };
  }
}
