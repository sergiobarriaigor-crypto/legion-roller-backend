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
  // 0-1: opacidad de la tarjeta de resumen (km/tiempo) sobre el mapa en
  // render.html -- 0 durante toda la ruta y la apertura, sube a 1 recién en
  // el cierre (ver calcularKeyframesFlyover). Viaja por cuadro (en vez de
  // ser un simple booleano "mostrar/ocultar") para que el fundido se vea
  // suave sin depender de una transición CSS -- acá cada jumpTo es una
  // captura instantánea, no hay animación real entre cuadros.
  opacidadResumen: number;
}

// Bajado de 24: el cuello de botella real de la generación es renderizar
// cada cuadro (WebGL por software, sin GPU real en Railway) uno por uno en
// secuencia -- menos cuadros por segundo de video = menos cuadros totales a
// renderizar para la misma duración, reducción proporcional del tiempo de
// generación. La cámara se mueve lento y suave acá (nada de paneos
// bruscos), así que 18 fps no se nota como "entrecortado" en este contenido
// puntual, a diferencia de contenido con movimiento rápido.
const FPS = 18;
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

// El GPS de un teléfono nunca cae justo en la línea recta real -- jitter
// lateral de unos metros hace zigzaguear el trazado crudo incluso en una
// recta perfecta. La cámara del flyover sigue ese trazado punto a punto
// (calcularKeyframes interpola sobre él), así que ese zigzag microscópico
// en el mapa se ve amplificado en el video como si la cámara serpenteara
// sin sentido. Simplificar antes de calcular keyframes (algoritmo
// Douglas-Peucker) aplana los tramos rectos sin perder curvas reales -- una
// curva de verdad se aleja más que la tolerancia de la línea entre sus
// extremos y sus puntos se conservan.
const TOLERANCIA_SIMPLIFICADO_KM = 0.01; // 10 metros

// Distancia perpendicular de `punto` al segmento a-b, en km. Aproximación
// plana (equirrectangular, con corrección de longitud por latitud) --
// suficiente a esta escala (unas pocas decenas de metros como mucho), no
// hace falta geometría esférica completa para comparar distancias dentro
// de un mismo tramo corto.
function distanciaPerpendicularKm(
  punto: PuntoGps,
  a: PuntoGps,
  b: PuntoGps,
): number {
  const KM_POR_GRADO_LAT = 111.32;
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const ax = a.lon * cosLat;
  const ay = a.lat;
  const bx = b.lon * cosLat;
  const by = b.lat;
  const px = punto.lon * cosLat;
  const py = punto.lat;

  const dx = bx - ax;
  const dy = by - ay;
  const largoCuadrado = dx * dx + dy * dy;
  const t =
    largoCuadrado > 0
      ? clamp(((px - ax) * dx + (py - ay) * dy) / largoCuadrado, 0, 1)
      : 0;
  const proyX = ax + t * dx;
  const proyY = ay + t * dy;
  return Math.sqrt((px - proyX) ** 2 + (py - proyY) ** 2) * KM_POR_GRADO_LAT;
}

function simplificarRuta(puntos: PuntoGps[], toleranciaKm: number): PuntoGps[] {
  if (puntos.length <= 2) return puntos;

  let distanciaMaxima = 0;
  let indiceMaximo = 0;
  const inicio = puntos[0];
  const fin = puntos[puntos.length - 1];
  for (let i = 1; i < puntos.length - 1; i++) {
    const d = distanciaPerpendicularKm(puntos[i], inicio, fin);
    if (d > distanciaMaxima) {
      distanciaMaxima = d;
      indiceMaximo = i;
    }
  }

  if (distanciaMaxima > toleranciaKm) {
    const izquierda = simplificarRuta(
      puntos.slice(0, indiceMaximo + 1),
      toleranciaKm,
    );
    const derecha = simplificarRuta(puntos.slice(indiceMaximo), toleranciaKm);
    return [...izquierda.slice(0, -1), ...derecha];
  }

  return [inicio, fin];
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
      opacidadResumen: 0,
    });
  }

  return keyframes;
}

interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

function calcularBbox(puntos: PuntoGps[]): Bbox {
  let minLat = puntos[0].lat;
  let maxLat = puntos[0].lat;
  let minLon = puntos[0].lon;
  let maxLon = puntos[0].lon;
  for (const p of puntos) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

// Resolución del video -- tiene que coincidir con ANCHO_VIDEO/ALTO_VIDEO en
// flyover-render.service.ts. Se necesita acá (este archivo no tiene acceso
// al DOM/MapLibre real) solo para estimar qué zoom deja todo el trazado
// visible en la toma panorámica de apertura/cierre.
const ANCHO_VIDEO_PX = 540;
const ALTO_VIDEO_PX = 960;
// Fracción del viewport que debería ocupar el trazado en la panorámica
// (deja aire alrededor en vez de tocar los bordes).
const MARGEN_PANORAMICA = 0.72;
// Pitch de la toma panorámica de apertura/cierre -- bastante más plano que
// PITCH_CAMARA (cámara "pegada al piso" de la ruta) para que se vea como
// una vista aérea de ciudad/trazado completo, no como un cuadro más del
// recorrido.
const PITCH_PANORAMICA = 42;
// La fórmula de zoom-para-ajustar de abajo es la clásica de vista CENITAL
// plana (Google Maps/Mapbox) -- con pitch>0 la cámara en los hechos ve más
// terreno hacia el fondo de lo que esa fórmula asume, así que restar acá da
// margen de sobra en vez de arriesgarse a cortar el trazado en el video.
const MARGEN_ZOOM_POR_PITCH = 1;
const ZOOM_MAX_PANORAMICA = 18;

// Fórmula estándar de "zoom para ajustar bounds" (la misma idea que usan
// Google Maps/Mapbox internamente) -- mundo de tiles de 256px en zoom 0.
function zoomParaAjustarBbox(bbox: Bbox): number {
  function latRad(lat: number): number {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return clamp(radX2, -Math.PI, Math.PI) / 2;
  }
  function zoomEje(pxDisponibles: number, fraccion: number): number {
    if (fraccion <= 0) return ZOOM_MAX_PANORAMICA;
    return Math.log2(pxDisponibles / 256 / fraccion);
  }
  const fraccionLat = (latRad(bbox.maxLat) - latRad(bbox.minLat)) / Math.PI;
  const dLon = bbox.maxLon - bbox.minLon;
  const fraccionLon = (dLon < 0 ? dLon + 360 : dLon) / 360;
  const zoomLat = zoomEje(ALTO_VIDEO_PX * MARGEN_PANORAMICA, fraccionLat);
  const zoomLon = zoomEje(ANCHO_VIDEO_PX * MARGEN_PANORAMICA, fraccionLon);
  return clamp(
    Math.min(zoomLat, zoomLon, ZOOM_MAX_PANORAMICA) - MARGEN_ZOOM_POR_PITCH,
    1,
    ZOOM_MAX_PANORAMICA,
  );
}

function interpolarAngulo(desde: number, hasta: number, t: number): number {
  return (desde + diferenciaAngular(desde, hasta) * t + 360) % 360;
}

// Suavizado tipo "ease in/out" (smoothstep) -- para que las tomas de
// apertura/cierre aceleren y frenen en vez de moverse a velocidad
// constante, más cinematográfico que la interpolación lineal usada para el
// avance por la ruta (ahí lineal es correcto porque representa velocidad
// real de desplazamiento).
function suavizarT(t: number): number {
  return t * t * (3 - 2 * t);
}

function crearFramesTransicion(
  desde: Pick<KeyframeCamara, 'center' | 'zoom' | 'pitch' | 'bearing'>,
  hasta: Pick<KeyframeCamara, 'center' | 'zoom' | 'pitch' | 'bearing'>,
  frames: number,
  lineaFn: (tLineal: number) => [number, number][],
  opacidadFn: (tLineal: number) => number,
): KeyframeCamara[] {
  const resultado: KeyframeCamara[] = [];
  for (let i = 0; i < frames; i++) {
    const tLineal = frames > 1 ? i / (frames - 1) : 1;
    const t = suavizarT(tLineal);
    resultado.push({
      center: [
        desde.center[0] + (hasta.center[0] - desde.center[0]) * t,
        desde.center[1] + (hasta.center[1] - desde.center[1]) * t,
      ],
      zoom: desde.zoom + (hasta.zoom - desde.zoom) * t,
      pitch: desde.pitch + (hasta.pitch - desde.pitch) * t,
      bearing: interpolarAngulo(desde.bearing, hasta.bearing, t),
      lineaHastaAqui: lineaFn(tLineal),
      opacidadResumen: opacidadFn(tLineal),
    });
  }
  return resultado;
}

// Cuánto dura cada tramo agregado a la ruta principal (calcularKeyframes):
// apertura elevada sobre la zona -> acercamiento al inicio, y al llegar al
// final, alejamiento a vista panorámica completa + resumen (km/tiempo).
const DURACION_INTRO_SEG = 3;
const DURACION_OUTRO_TRANSICION_SEG = 2.5;
const DURACION_OUTRO_HOLD_SEG = 2.5;

// Arma el video completo: apertura panorámica -> recorrido (calcularKeyframes,
// sin tocar) -> alejamiento a panorámica completa con resumen. Separada de
// calcularKeyframes (que sigue siendo la ruta "pura", sin apertura/cierre)
// para no tocar esa función ya probada en producción -- esta solo la envuelve.
export function calcularKeyframesFlyover(
  puntosOriginales: PuntoGps[],
  distanciaKm: number,
): KeyframeCamara[] {
  // simplificarRuta siempre conserva al menos el primer y último punto, así
  // que esto nunca deja menos de 2 puntos si puntosOriginales ya tenía al
  // menos 2 (ver validación al inicio de calcularKeyframes).
  const puntos = simplificarRuta(puntosOriginales, TOLERANCIA_SIMPLIFICADO_KM);
  const principal = calcularKeyframes(puntos, distanciaKm);
  const bbox = calcularBbox(puntos);
  const centroBbox: [number, number] = [
    (bbox.minLon + bbox.maxLon) / 2,
    (bbox.minLat + bbox.maxLat) / 2,
  ];
  const panoramica = {
    center: centroBbox,
    zoom: zoomParaAjustarBbox(bbox),
    pitch: PITCH_PANORAMICA,
    bearing: 0,
  };

  const inicioRuta = principal[0];
  const finRuta = principal[principal.length - 1];
  const lineaCompleta: [number, number][] = puntos.map((p) => [p.lon, p.lat]);
  // Línea degenerada (2 puntos idénticos) en vez de vacía -- geometry
  // LineString de GeoJSON necesita al menos 2 posiciones; con 0 longitud no
  // se ve trazo real, solo asegura que el source quede en un estado válido
  // durante la apertura (antes de que arranque el recorrido real).
  const lineaAntesDeArrancar: [number, number][] = [
    inicioRuta.center,
    inicioRuta.center,
  ];

  const framesIntro = crearFramesTransicion(
    panoramica,
    inicioRuta,
    Math.round(FPS * DURACION_INTRO_SEG),
    () => lineaAntesDeArrancar,
    () => 0,
  );
  const framesOutroTransicion = crearFramesTransicion(
    finRuta,
    panoramica,
    Math.round(FPS * DURACION_OUTRO_TRANSICION_SEG),
    () => lineaCompleta,
    (tLineal) => tLineal,
  );
  const framesOutroHold = crearFramesTransicion(
    panoramica,
    panoramica,
    Math.round(FPS * DURACION_OUTRO_HOLD_SEG),
    () => lineaCompleta,
    () => 1,
  );

  return [
    ...framesIntro,
    ...principal,
    ...framesOutroTransicion,
    ...framesOutroHold,
  ];
}

export function duracionSegDeKeyframes(keyframes: KeyframeCamara[]): number {
  return Math.round(keyframes.length / FPS);
}

export const FLYOVER_FPS = FPS;
