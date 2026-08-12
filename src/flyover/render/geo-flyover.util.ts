// Cálculo de los keyframes de cámara (center/zoom/pitch/bearing) para el
// video flyover 3D. TS puro sin dependencias de DOM/Puppeteer, para poder
// testearlo con jest sin levantar Chromium.
//
// La cámara avanza por FRACCIÓN DE DISTANCIA ACUMULADA en el trazado (no por
// tiempo real): así una parada real del patinador a mitad de ruta no
// aparece como la cámara quedándose detenida, y la duración final del
// video queda fija independiente de cuánto duró la rodada real.

export interface PuntoGps {
  lat: number;
  lon: number;
  timestamp: number;
}

export interface KeyframeCamara {
  center: [number, number]; // [lon, lat], orden que espera MapLibre
  zoom: number;
  pitch: number;
  bearing: number;
  // Coordenadas [lon, lat] recorridas hasta este cuadro (puntos reales del
  // trazado ya superados + el punto interpolado exacto de "center" al
  // final) -- para dibujar la línea del recorrido progresivamente en
  // render.html, sincronizada con el avance real de la cámara, en vez de
  // mostrarla completa desde el primer cuadro.
  lineaHastaAqui: [number, number][];
}

const FPS = 24;
const DURACION_MIN_SEG = 8;
const DURACION_MAX_SEG = 50;
const FACTOR_SEG_POR_KM = 2;
// Pitch/zoom más altos que el original (60/16.5) a propósito para que la
// cámara se sienta más pegada al piso en vez de una vista aérea inclinada.
// Lo ideal sería una cámara libre con altura explícita en metros
// (maplibregl.FreeCameraOptions), pero MapLibre GL JS v6 (la versión
// instalada, ver package.json) eliminó esa API de su build público -- no
// está ni en el .d.ts ni en el bundle. Con el modelo de cámara estándar
// (center/zoom/pitch/bearing), acercar el pitch a la horizontal es lo que
// geométricamente baja la altura de la cámara sobre el punto que mira.
//
// Un primer intento con pitch=78/zoom=17.2 rompió la generación en Railway
// (ffmpeg fallaba al codificar -- probablemente frames corruptos por el
// software-rendering de WebGL, sin GPU real, bajo más carga con terreno
// real a ese ángulo). 70/16.8 es un paso más conservador: sigue notándose
// más bajo que el original, con menos riesgo de saturar el renderizado.
const ZOOM_CAMARA = 16.8;
const PITCH_CAMARA = 70;
// Qué tan adelante en el trazado mirar para calcular el rumbo de la cámara
// -- muy corto y el rumbo tiembla con el ruido del GPS punto a punto.
const ADELANTO_RUMBO_KM = 0.05;
// Suavizado angular entre frames consecutivos (0 = no se mueve nunca, 1 =
// sigue el rumbo objetivo sin suavizado) -- evita giros bruscos.
const SUAVIZADO_BEARING = 0.25;

// Fórmula de Haversine (mismo criterio que frontend/src/lib/geo.ts y
// mapa.service.ts, duplicada acá porque el proyecto no comparte código
// entre frontend/backend).
export function distanciaHaversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const radioTierraKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radioTierraKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Rumbo inicial (forward azimuth) de a hacia b, en grados [0, 360).
function rumboInicial(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const rumboRad = Math.atan2(y, x);
  return ((rumboRad * 180) / Math.PI + 360) % 360;
}

// Diferencia angular más corta entre dos rumbos, en el rango (-180, 180].
function diferenciaAngular(desde: number, hasta: number): number {
  const diff = ((hasta - desde + 540) % 360) - 180;
  return diff;
}

function clamp(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

interface PuntoConAcumulado extends PuntoGps {
  acumuladaKm: number;
}

function construirAcumulados(puntos: PuntoGps[]): PuntoConAcumulado[] {
  const resultado: PuntoConAcumulado[] = [{ ...puntos[0], acumuladaKm: 0 }];
  for (let i = 1; i < puntos.length; i++) {
    const anterior = resultado[i - 1];
    const tramoKm = distanciaHaversineKm(puntos[i - 1], puntos[i]);
    resultado.push({
      ...puntos[i],
      acumuladaKm: anterior.acumuladaKm + tramoKm,
    });
  }
  return resultado;
}

// Interpola lat/lon en el trazado a una distancia acumulada objetivo dada.
function interpolarEnRuta(
  acumulados: PuntoConAcumulado[],
  distanciaObjetivoKm: number,
): { lat: number; lon: number } {
  const total = acumulados[acumulados.length - 1].acumuladaKm;
  const objetivo = clamp(distanciaObjetivoKm, 0, total);

  let i = 1;
  while (i < acumulados.length - 1 && acumulados[i].acumuladaKm < objetivo) {
    i++;
  }
  const anterior = acumulados[i - 1];
  const siguiente = acumulados[i];
  const tramoKm = siguiente.acumuladaKm - anterior.acumuladaKm;
  const fraccionTramo =
    tramoKm > 0 ? (objetivo - anterior.acumuladaKm) / tramoKm : 0;

  return {
    lat: anterior.lat + (siguiente.lat - anterior.lat) * fraccionTramo,
    lon: anterior.lon + (siguiente.lon - anterior.lon) * fraccionTramo,
  };
}

export function calcularKeyframes(
  puntos: PuntoGps[],
  distanciaKm: number,
): KeyframeCamara[] {
  if (puntos.length < 2) {
    throw new Error('Se necesitan al menos 2 puntos para calcular keyframes');
  }

  const acumulados = construirAcumulados(puntos);
  const totalKm = acumulados[acumulados.length - 1].acumuladaKm || distanciaKm;

  const duracionSeg = clamp(
    distanciaKm * FACTOR_SEG_POR_KM,
    DURACION_MIN_SEG,
    DURACION_MAX_SEG,
  );
  const totalFrames = Math.round(FPS * duracionSeg);

  const keyframes: KeyframeCamara[] = [];
  let bearingSuavizado = 0;
  let bearingInicializado = false;
  // Puntos reales (no interpolados) ya superados, en orden -- crece de a
  // uno a medida que la distancia acumulada de cada cuadro los va dejando
  // atrás. Arranca con el primer punto de la ruta.
  const puntosRecorridos: [number, number][] = [
    [acumulados[0].lon, acumulados[0].lat],
  ];
  let cursorAcumulados = 1;

  for (let i = 0; i < totalFrames; i++) {
    const fraccion = totalFrames > 1 ? i / (totalFrames - 1) : 1;
    const distanciaActualKm = fraccion * totalKm;
    const punto = interpolarEnRuta(acumulados, distanciaActualKm);
    const puntoAdelante = interpolarEnRuta(
      acumulados,
      distanciaActualKm + ADELANTO_RUMBO_KM,
    );

    while (
      cursorAcumulados < acumulados.length &&
      acumulados[cursorAcumulados].acumuladaKm <= distanciaActualKm
    ) {
      puntosRecorridos.push([
        acumulados[cursorAcumulados].lon,
        acumulados[cursorAcumulados].lat,
      ]);
      cursorAcumulados++;
    }

    const rumboObjetivo =
      punto.lat === puntoAdelante.lat && punto.lon === puntoAdelante.lon
        ? bearingSuavizado
        : rumboInicial(punto, puntoAdelante);

    if (!bearingInicializado) {
      bearingSuavizado = rumboObjetivo;
      bearingInicializado = true;
    } else {
      bearingSuavizado =
        (bearingSuavizado +
          diferenciaAngular(bearingSuavizado, rumboObjetivo) *
            SUAVIZADO_BEARING +
          360) %
        360;
    }

    keyframes.push({
      center: [punto.lon, punto.lat],
      zoom: ZOOM_CAMARA,
      pitch: PITCH_CAMARA,
      bearing: bearingSuavizado,
      lineaHastaAqui: [...puntosRecorridos, [punto.lon, punto.lat]],
    });
  }

  return keyframes;
}

export function duracionSegDeKeyframes(keyframes: KeyframeCamara[]): number {
  return Math.round(keyframes.length / FPS);
}

export const FLYOVER_FPS = FPS;
