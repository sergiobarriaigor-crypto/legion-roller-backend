import { Injectable, Logger } from '@nestjs/common';

export interface ClimaCiudad {
  clave: string;
  nombre: string;
  temperatura: number;
  icono: string;
  descripcion: string;
  actualizadoEn: string;
}

const CIUDADES = [
  {
    clave: 'puerto-montt',
    nombre: 'Puerto Montt',
    lat: -41.4693,
    lon: -72.9424,
  },
  {
    clave: 'puerto-varas',
    nombre: 'Puerto Varas',
    lat: -41.3195,
    lon: -72.9854,
  },
] as const;

const TTL_MS = 30 * 60 * 1000;

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

// Caché en memoria — mismo criterio ya usado por ChatPresenceService /
// VerificacionCorreoService para estado efímero sin tabla nueva en la base.
// Se sirve del caché mientras esté vigente (TTL_MS); ClimaScheduler lo
// refresca proactivamente cada 30 min para que las consultas casi nunca
// tengan que esperar la llamada a Open-Meteo.
@Injectable()
export class ClimaService {
  private readonly logger = new Logger(ClimaService.name);
  private cache = new Map<string, ClimaCiudad>();

  private vigente(entrada: ClimaCiudad | undefined): entrada is ClimaCiudad {
    if (!entrada) return false;
    return Date.now() - new Date(entrada.actualizadoEn).getTime() < TTL_MS;
  }

  private async consultarOpenMeteo(
    ciudad: (typeof CIUDADES)[number],
  ): Promise<ClimaCiudad> {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${ciudad.lat}&longitude=${ciudad.lon}` +
      `&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo respondió ${res.status}`);
    }
    const datos = (await res.json()) as {
      current: { temperature_2m: number; weather_code: number };
    };
    const { icono, descripcion } = mapearCodigo(datos.current.weather_code);
    const entrada: ClimaCiudad = {
      clave: ciudad.clave,
      nombre: ciudad.nombre,
      temperatura: Math.round(datos.current.temperature_2m),
      icono,
      descripcion,
      actualizadoEn: new Date().toISOString(),
    };
    this.cache.set(ciudad.clave, entrada);
    return entrada;
  }

  async obtenerTodas(): Promise<ClimaCiudad[]> {
    const resultados: ClimaCiudad[] = [];
    for (const ciudad of CIUDADES) {
      const cacheada = this.cache.get(ciudad.clave);
      if (this.vigente(cacheada)) {
        resultados.push(cacheada);
        continue;
      }
      try {
        resultados.push(await this.consultarOpenMeteo(ciudad));
      } catch (err) {
        this.logger.warn(
          `No se pudo obtener el clima de ${ciudad.nombre}: ${(err as Error).message}`,
        );
        // Si falla la consulta pero había un dato vencido en caché, se sirve
        // igual (mejor un dato viejo que nada) — solo se omite si nunca hubo dato.
        if (cacheada) resultados.push(cacheada);
      }
    }
    return resultados;
  }

  async refrescarTodas(): Promise<void> {
    for (const ciudad of CIUDADES) {
      try {
        await this.consultarOpenMeteo(ciudad);
      } catch (err) {
        this.logger.warn(
          `No se pudo refrescar el clima de ${ciudad.nombre}: ${(err as Error).message}`,
        );
      }
    }
  }
}
