/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await --
   Pruebas de cuerpos HTTP/JSON arbitrarios (supertest devuelve any) y dobles de Prisma. */
// El cliente de Prisma generado (ESM con imports .js) no se puede cargar bajo
// ts-jest. MapaService solo usa PrismaService como token de inyección y la
// base de datos está simulada, así que se reemplaza por una clase vacía.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { Logger, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as fs from 'node:fs';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { configurarBodyParsers } from '../configurar-body-parsers';
import { ResumenGpsV2Dto } from './dto/resumen-gps-v2.dto';
import { MapaController } from './mapa.controller';
import { MapaService } from './mapa.service';

// Cubre D1 y la compatibilidad del DTO de "tres relojes":
//  - el DTO acepta clientes viejos y nuevos, y rechaza lo mal formado;
//  - el flujo REAL (controlador + servicio reales, solo Prisma simulado)
//    persiste los 4 bloques nuevos sin perder nada;
//  - un 413 o un fallo de persistencia NO se silencian.
//
// Con DIAG_HEARTBEAT_JSON=<ruta> se usa además el JSON REAL que produce el
// codificador nativo (la prueba Android DiagnosticoHeartbeatRelojesTest lo
// deja en frontend/android/app/build/test-output/).
const RUTA_JSON_REAL = process.env.DIAG_HEARTBEAT_JSON;

const T0 = 1_790_000_000_000;

function snapshotsEnergia(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: T0 + i * 5000,
    isInteractive: i % 80 < 40,
    isDeviceIdleMode: false,
    isPowerSaveMode: false,
    isIgnoringBatteryOptimizations: false,
    memoryImportance: 125,
  }));
}

// Mismo formato que exporta DiagnosticoHeartbeat.java (columnas con deltas).
function bloquesNuevos(ticks: number, cortes: number) {
  const n = Math.min(ticks, 240);
  return {
    relojesHeartbeat: {
      paso: ticks > 240 ? 2 : 1,
      n,
      w0: T0,
      u0: 400_000_000,
      e0: 900_000_000,
      dw: Array.from({ length: n - 1 }, () => 10000),
      du: Array.from({ length: n - 1 }, () => 10000),
      de: Array.from({ length: n - 1 }, () => 10000),
      fl: Array.from({ length: n }, (_, i) => 4 + (i % 2)),
      imp: Array.from({ length: n }, () => 125),
      ultimo: {
        i: ticks - 1,
        w: T0 + ticks * 5000,
        u: 400_000_000 + ticks * 5000,
        e: 900_000_000 + ticks * 5000,
        fl: 5,
        imp: 125,
      },
    },
    cortesHeartbeat: Array.from({ length: cortes }, (_, i) => ({
      i: 10 + i,
      pw: T0 + i * 300000,
      pu: 400_000_000 + i * 300000,
      pe: 900_000_000 + i * 300000,
      w: T0 + i * 300000 + 270000,
      u: 400_000_000 + i * 300000 + 5000,
      e: 900_000_000 + i * 300000 + 270000,
      dw: 270000,
      du: 5000,
      de: 270000,
      r: 0.019,
      f0: 324,
      f1: 292,
      imp: 125,
      bk: 10,
      th: 0,
      pc: 87,
      tp: 289,
      hilo: 'CapacitorPlugins',
    })),
    muestrasLentas: Array.from({ length: 30 }, (_, i) => ({
      w: T0 + i * 60000,
      e: 900_000_000 + i * 60000,
      bk: 10,
      th: 0,
      pc: 87 - Math.floor(i / 10),
      tp: 289,
    })),
    contadoresHeartbeat: {
      version: 1,
      sdk: 35,
      umbralCorteMs: 7500,
      paso: ticks > 240 ? 2 : 1,
      decimaciones: ticks > 240 ? 1 : 0,
      cortesDescartados: 0,
      costoTickN: ticks,
      costoTickMedioUs: 420,
      costoTickMaxUs: 1900,
      fallos: {
        general: 0,
        luz: 0,
        wakelock: 0,
        bgr: 0,
        bucket: 0,
        termica: 0,
        bateria: 0,
      },
    },
  };
}

function resumenCompleto(opts: {
  ticks: number;
  cortes: number;
  puntos: number;
  conNuevo: boolean;
}) {
  const nativoBase = {
    total: 1165,
    ultimoTimestamp: T0 + 1_800_000,
    maxIntervaloSeg: 5.1,
    huecosNativos: Array.from({ length: opts.cortes }, (_, i) => ({
      anteriorTimestamp: T0 + i,
      actualTimestamp: T0 + i + 270000,
      intervaloSeg: 270,
    })),
    eventosDisponibilidadProveedor: Array.from({ length: 200 }, (_, i) => ({
      disponible: i % 2 === 0,
      horaNativa: T0 + i * 1000,
    })),
    eventosPauseResumeActivity: [],
    watchersActivos: 1,
    maxWatchersSimultaneos: 1,
    eventosWatchers: [{ hora: T0, cantidad: 1 }],
    foregroundIntentos: 1,
    foregroundExitos: 1,
    foregroundErrores: [],
    threadsRequestUpdates: [],
    totalHeartbeats: opts.ticks,
    ultimoHeartbeatTimestamp: T0 + opts.ticks * 5000,
    maxIntervaloHeartbeatSeg: 270,
    huecosHeartbeat: Array.from({ length: opts.cortes }, (_, i) => ({
      anteriorTimestamp: T0 + i,
      actualTimestamp: T0 + i + 270000,
      intervaloSeg: 270,
      isDeviceIdleMode: false,
      isInteractive: false,
      memoryImportance: 125,
      nombreThread: 'CapacitorPlugins',
    })),
    snapshotsEnergia: snapshotsEnergia(Math.min(opts.ticks, 400)),
    transicionesEnergia: [
      { tipo: 'screen', anterior: true, nuevo: false, timestamp: T0 },
    ],
  };
  return {
    fixesRecibidos: 1165,
    puntosConfiables: Array.from({ length: opts.puntos }, (_, i) => ({
      lat: Number((-33.4372851 + i * 1e-5).toFixed(7)),
      lon: Number((-70.6506434 + i * 1e-5).toFixed(7)),
      timestamp: T0 + i * 1000,
    })),
    discontinuidades: [],
    entradasRecuperacion: [],
    candidatosPendientes: 0,
    candidatosRecuperacion: 0,
    rechazados: [{ motivo: 'accuracy', cantidad: 3 }],
    ruido: 2,
    maxIntervaloEntreFixesCrudosSeg: 111.7,
    fixesRecibidosFuenteNoDisponible: 0,
    eventosDisponibilidad: [],
    diagnosticoNativo: opts.conNuevo
      ? { ...nativoBase, ...bloquesNuevos(opts.ticks, opts.cortes) }
      : nativoBase,
  };
}

const bytesDe = (o: unknown) => Buffer.byteLength(JSON.stringify(o), 'utf8');

describe('DTO: tres relojes (aditivo y validado)', () => {
  const validar = (payload: unknown) =>
    validate(plainToInstance(ResumenGpsV2Dto, payload), { whitelist: true });

  it('cliente VIEJO (sin ningún campo nuevo) valida', async () => {
    expect(
      await validar(
        resumenCompleto({ ticks: 360, cortes: 5, puntos: 50, conNuevo: false }),
      ),
    ).toHaveLength(0);
  });

  it('cliente NUEVO valida y conserva los 4 bloques', async () => {
    const p = resumenCompleto({
      ticks: 360,
      cortes: 5,
      puntos: 50,
      conNuevo: true,
    });
    const inst = plainToInstance(ResumenGpsV2Dto, p);
    expect(await validate(inst, { whitelist: true })).toHaveLength(0);
    const nativo: any = JSON.parse(JSON.stringify(inst)).diagnosticoNativo;
    expect(nativo.relojesHeartbeat.n).toBe(240);
    expect(nativo.cortesHeartbeat).toHaveLength(5);
    expect(nativo.muestrasLentas).toHaveLength(30);
    expect(nativo.contadoresHeartbeat.fallos.general).toBe(0);
  });

  it('campo mal formado en un corte falla', async () => {
    const p: any = resumenCompleto({
      ticks: 360,
      cortes: 3,
      puntos: 10,
      conNuevo: true,
    });
    p.diagnosticoNativo.cortesHeartbeat[1].r = 'no-es-un-numero';
    expect((await validar(p)).length).toBeGreaterThan(0);
  });

  it('serie con valores no numéricos falla', async () => {
    const p: any = resumenCompleto({
      ticks: 360,
      cortes: 3,
      puntos: 10,
      conNuevo: true,
    });
    p.diagnosticoNativo.relojesHeartbeat.dw[3] = 'x';
    expect((await validar(p)).length).toBeGreaterThan(0);
  });

  it('más de 60 cortes falla (ArrayMaxSize)', async () => {
    const p: any = resumenCompleto({
      ticks: 360,
      cortes: 61,
      puntos: 10,
      conNuevo: true,
    });
    expect((await validar(p)).length).toBeGreaterThan(0);
  });

  it('whitelist elimina campos intrusos dentro de los bloques nuevos', async () => {
    const p: any = resumenCompleto({
      ticks: 360,
      cortes: 2,
      puntos: 10,
      conNuevo: true,
    });
    p.diagnosticoNativo.relojesHeartbeat.intruso = 'x';
    p.diagnosticoNativo.cortesHeartbeat[0].intruso = 'x';
    p.diagnosticoNativo.contadoresHeartbeat.intruso = 'x';
    const inst = plainToInstance(ResumenGpsV2Dto, p);
    await validate(inst, { whitelist: true });
    const n: any = JSON.parse(JSON.stringify(inst)).diagnosticoNativo;
    expect(n.relojesHeartbeat.intruso).toBeUndefined();
    expect(n.cortesHeartbeat[0].intruso).toBeUndefined();
    expect(n.contadoresHeartbeat.intruso).toBeUndefined();
  });
});

describe('POST /mapa/recorridos/:id/comparacion-v2 (controlador y servicio REALES)', () => {
  let app: INestApplication;
  let persistido: string | undefined;
  const prismaFalso = {
    recorrido: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeAll(async () => {
    const servicio = new MapaService(prismaFalso as never, {} as never);
    const modulo = await Test.createTestingModule({
      controllers: [MapaController],
      providers: [{ provide: MapaService, useValue: servicio }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 1 };
          return true;
        },
      })
      .compile();
    const expressApp = modulo.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configurarBodyParsers(expressApp);
    expressApp.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await expressApp.init();
    app = expressApp;
  });

  beforeEach(() => {
    persistido = undefined;
    prismaFalso.recorrido.findFirst.mockReset().mockResolvedValue({ id: 7 });
    prismaFalso.recorrido.update
      .mockReset()
      .mockImplementation(async ({ data }: any) => {
        persistido = data.diagnosticoGpsV2;
        return {};
      });
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => app.close());

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post('/mapa/recorridos/7/comparacion-v2')
      .send(body as object);

  it('cliente VIEJO: 201 y se persiste igual que siempre (sin bloques nuevos)', async () => {
    const r = await post(
      resumenCompleto({ ticks: 360, cortes: 5, puntos: 50, conNuevo: false }),
    );
    expect(r.status).toBe(201);
    const guardado = JSON.parse(persistido!);
    expect(guardado.diagnosticoNativo.snapshotsEnergia).toHaveLength(360);
    expect(guardado.diagnosticoNativo.relojesHeartbeat).toBeUndefined();
  });

  it('cliente NUEVO 30 min: 201 y los 4 bloques persisten SIN pérdida', async () => {
    const enviado: any = resumenCompleto({
      ticks: 360,
      cortes: 5,
      puntos: 300,
      conNuevo: true,
    });
    const tamano = bytesDe(enviado);

    console.log(
      `TAMANO cuerpo sintetico 30min: ${tamano} B (limite defecto 102400, limite ruta 307200)`,
    );
    const r = await post(enviado);
    expect(r.status).toBe(201);
    const g = JSON.parse(persistido!).diagnosticoNativo;
    expect(g.relojesHeartbeat).toEqual(
      enviado.diagnosticoNativo.relojesHeartbeat,
    );
    expect(g.cortesHeartbeat).toEqual(
      enviado.diagnosticoNativo.cortesHeartbeat,
    );
    expect(g.muestrasLentas).toEqual(enviado.diagnosticoNativo.muestrasLentas);
    expect(g.contadoresHeartbeat).toEqual(
      enviado.diagnosticoNativo.contadoresHeartbeat,
    );
    expect(g.snapshotsEnergia).toHaveLength(360);
    expect(r.body.guardado).toBe(true);
    expect(r.body.bytes).toBe(Buffer.byteLength(persistido!, 'utf8'));
  });

  const siHayJsonReal = RUTA_JSON_REAL ? it : it.skip;
  siHayJsonReal(
    'JSON REAL del codificador nativo (30 y 60 min): 201 y persiste completo',
    async () => {
      for (const archivo of [
        RUTA_JSON_REAL!,
        RUTA_JSON_REAL!.replace('30min', '60min'),
      ]) {
        const real = JSON.parse(fs.readFileSync(archivo, 'utf8'));
        const enviado: any = resumenCompleto({
          ticks: 360,
          cortes: 5,
          puntos: 300,
          conNuevo: false,
        });
        enviado.diagnosticoNativo = {
          ...enviado.diagnosticoNativo,
          totalHeartbeats: real.totalHeartbeats,
          ultimoHeartbeatTimestamp: real.ultimoHeartbeatTimestamp,
          maxIntervaloHeartbeatSeg: real.maxIntervaloHeartbeatSeg,
          huecosHeartbeat: real.huecosHeartbeat,
          snapshotsEnergia: real.snapshotsEnergia,
          transicionesEnergia: real.transicionesEnergia,
          relojesHeartbeat: real.relojesHeartbeat,
          cortesHeartbeat: real.cortesHeartbeat,
          muestrasLentas: real.muestrasLentas,
          contadoresHeartbeat: real.contadoresHeartbeat,
        };
        const tamano = bytesDe(enviado);

        console.log(
          `TAMANO cuerpo con JSON REAL (${archivo.split(/[\\/]/).pop()}): ${tamano} B | nuevos=${bytesDe(real.relojesHeartbeat) + bytesDe(real.cortesHeartbeat) + bytesDe(real.muestrasLentas) + bytesDe(real.contadoresHeartbeat)} B`,
        );
        const r = await post(enviado);
        expect(r.status).toBe(201);
        const g = JSON.parse(persistido!).diagnosticoNativo;
        expect(g.relojesHeartbeat).toEqual(real.relojesHeartbeat);
        expect(g.cortesHeartbeat).toEqual(real.cortesHeartbeat);
        expect(g.muestrasLentas).toEqual(real.muestrasLentas);
        expect(g.contadoresHeartbeat).toEqual(real.contadoresHeartbeat);
      }
    },
  );

  it('cuerpo de ~150 KB (> 100 KB): ahora se acepta Y se persiste completo', async () => {
    const enviado = resumenCompleto({
      ticks: 360,
      cortes: 5,
      puntos: 1800,
      conNuevo: true,
    });
    const tamano = bytesDe(enviado);
    expect(tamano).toBeGreaterThan(102_400);
    expect(tamano).toBeLessThan(307_200);
    const r = await post(enviado);
    expect(r.status).toBe(201);
    expect(JSON.parse(persistido!).puntosConfiables).toHaveLength(1800);
  });

  it('cuerpo > 300 KB: 413 explícito, log de error y NADA se persiste', async () => {
    const r = await post(
      resumenCompleto({ ticks: 360, cortes: 5, puntos: 5000, conNuevo: true }),
    );
    expect(r.status).toBe(413);
    expect(r.body.statusCode).toBe(413);
    expect(prismaFalso.recorrido.update).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0][0])).toContain('413');
  });

  it('fallo de persistencia: 500 explícito y log de error con el tamaño (no se traga)', async () => {
    prismaFalso.recorrido.update
      .mockReset()
      .mockRejectedValue(new Error('conexion perdida con la base'));
    const r = await post(
      resumenCompleto({ ticks: 360, cortes: 5, puntos: 50, conNuevo: true }),
    );
    expect(r.status).toBe(500);
    const mensajes = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(
      mensajes.some(
        (m) => m.includes('NO se pudo persistir') && m.includes('bytes'),
      ),
    ).toBe(true);
  });

  it('bloque nuevo mal formado: 400 y nada se persiste', async () => {
    const p: any = resumenCompleto({
      ticks: 360,
      cortes: 3,
      puntos: 10,
      conNuevo: true,
    });
    p.diagnosticoNativo.cortesHeartbeat[0].de = 'roto';
    const r = await post(p);
    expect(r.status).toBe(400);
    expect(prismaFalso.recorrido.update).not.toHaveBeenCalled();
  });

  it('aviso en log cuando el diagnóstico se acerca al límite (> 240000 bytes)', async () => {
    const enviado = resumenCompleto({
      ticks: 360,
      cortes: 5,
      puntos: 2800,
      conNuevo: true,
    });
    expect(bytesDe(enviado)).toBeGreaterThan(240_000);
    expect(bytesDe(enviado)).toBeLessThan(307_200);
    const r = await post(enviado);
    expect(r.status).toBe(201);
    expect(
      warnSpy.mock.calls.some((c) => String(c[0]).includes('cerca del límite')),
    ).toBe(true);
  });
});
