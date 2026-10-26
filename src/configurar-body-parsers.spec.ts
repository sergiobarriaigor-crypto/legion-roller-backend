/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument --
   Pruebas de cuerpos HTTP/JSON arbitrarios (supertest devuelve any) y dobles de Prisma. */
import { Body, Controller, Logger, Param, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  LIMITE_BODY_COMPARACION_V2,
  LIMITE_BODY_DEFECTO,
  configurarBodyParsers,
} from './configurar-body-parsers';

// Controlador mínimo con las MISMAS rutas que importan: la de comparacion-v2
// y otra cualquiera (para comprobar que el límite mayor NO se filtra).
@Controller('mapa')
class ControladorDePrueba {
  @Post('recorridos/:id/comparacion-v2')
  comparacion(@Param('id') id: string, @Body() cuerpo: { relleno?: string }) {
    return { ok: true, id, largo: cuerpo.relleno?.length ?? 0 };
  }

  @Post('recorridos')
  otro(@Body() cuerpo: { relleno?: string }) {
    return { ok: true, largo: cuerpo.relleno?.length ?? 0 };
  }
}

const kb = (n: number) => ({ relleno: 'x'.repeat(n * 1024) });

describe('configurarBodyParsers (D1: límite por ruta y 413 explícito)', () => {
  let app: INestApplication;
  let errorSpy: jest.SpyInstance;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ControladorDePrueba],
    }).compile();
    // Igual que main.ts: bodyParser:false + configuración explícita.
    const expressApp = modulo.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configurarBodyParsers(expressApp);
    await expressApp.init();
    app = expressApp;
  });

  beforeEach(() => {
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  afterAll(async () => {
    await app.close();
  });

  it('constantes: 100kb por defecto y 300kb solo para comparacion-v2', () => {
    expect(LIMITE_BODY_DEFECTO).toBe('100kb');
    expect(LIMITE_BODY_COMPARACION_V2).toBe('300kb');
  });

  it('comparacion-v2 acepta 150 KB (> límite por defecto)', async () => {
    const r = await request(app.getHttpServer())
      .post('/mapa/recorridos/7/comparacion-v2')
      .send(kb(150));
    expect(r.status).toBe(201);
    expect(r.body.largo).toBe(150 * 1024);
  });

  it('comparacion-v2 acepta ~290 KB (justo bajo su límite)', async () => {
    const r = await request(app.getHttpServer())
      .post('/mapa/recorridos/7/comparacion-v2')
      .send(kb(290));
    expect(r.status).toBe(201);
  });

  it('comparacion-v2 rechaza 400 KB con 413 EXPLÍCITO y lo deja en el log de error', async () => {
    const r = await request(app.getHttpServer())
      .post('/mapa/recorridos/7/comparacion-v2')
      .send(kb(400));
    expect(r.status).toBe(413);
    expect(r.body).toMatchObject({
      statusCode: 413,
      error: 'Payload Too Large',
    });
    expect(r.body.limiteBytes).toBe(307200);
    expect(r.body.recibidoBytes).toBeGreaterThan(307200);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const mensaje = String(errorSpy.mock.calls[0][0]);
    expect(mensaje).toContain('413');
    expect(mensaje).toContain('/mapa/recorridos/7/comparacion-v2');
    expect(mensaje).not.toContain('xxxx'); // nunca se loguea el contenido del cuerpo
  });

  it('OTROS endpoints siguen en 100 KB: 150 KB -> 413', async () => {
    const r = await request(app.getHttpServer())
      .post('/mapa/recorridos')
      .send(kb(150));
    expect(r.status).toBe(413);
    expect(r.body.limiteBytes).toBe(102400);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('OTROS endpoints: 50 KB siguen pasando', async () => {
    const r = await request(app.getHttpServer())
      .post('/mapa/recorridos')
      .send(kb(50));
    expect(r.status).toBe(201);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
