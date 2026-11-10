import { gzipSync } from 'node:zlib';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { crearApp } from './app.js';

describe('crearApp', () => {
  const app = crearApp();

  it('GET /api/salud responde con el formato estándar de éxito', async () => {
    const respuesta = await request(app).get('/api/salud');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: { estado: 'ok' } });
  });

  it('una ruta inexistente responde 404 con el formato estándar de error', async () => {
    const respuesta = await request(app).get('/api/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });

  it('un JSON malformado responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/salud')
      .set('Content-Type', 'application/json')
      .send('{ invalido');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  // GHSA-27r3-jxmh-p828: un body comprimido no se descomprime (express.json con inflate: false).
  // Se rechaza antes de leerlo, con el formato de error de siempre y no como un 500.
  it('un body comprimido responde 400 VALIDATION_ERROR sin descomprimirlo', async () => {
    const respuesta = await request(app)
      .post('/api/salud')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(gzipSync(JSON.stringify({ a: 1 })));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: expect.any(String) },
    });
  });
});
