import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

const app = crearApp();

function cookieDe(
  rol:
    | 'RESPONSABLE_EVENTOS'
    | 'RESPONSABLE_FINANZAS'
    | 'GERENTE_GENERAL'
    | 'ADMINISTRADOR_SISTEMA'
    | 'CLIENTE',
) {
  return `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email: 'personal@confluens.test', rol })}`;
}

function configurarCloudinary() {
  vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'demo');
  vi.stubEnv('CLOUDINARY_API_KEY', '123456');
  vi.stubEnv('CLOUDINARY_API_SECRET', 'abcd');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/fotos/firma (ADR 0009)', () => {
  it('firma la subida a la carpeta del destino, sin exponer el secreto', async () => {
    configurarCloudinary();

    const respuesta = await request(app)
      .post('/api/fotos/firma')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')])
      .send({ destino: 'servicios' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      cloudName: 'demo',
      apiKey: '123456',
      carpeta: 'confluens/servicios',
      transformacion: 'c_limit,w_1920,h_1920',
    });
    expect(respuesta.body.data.firma).toMatch(/^[0-9a-f]{40}$/);
    expect(respuesta.text).not.toContain('abcd');
  });

  // HU-56: las fotos de la landing las cambian el GG y el ADM.
  it('el GG puede pedirla', async () => {
    configurarCloudinary();

    const respuesta = await request(app)
      .post('/api/fotos/firma')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ destino: 'salones' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.carpeta).toBe('confluens/salones');
  });

  it.each(['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS'] as const)(
    'el %s no puede pedirla: responde 403',
    async (rol) => {
      configurarCloudinary();

      const respuesta = await request(app)
        .post('/api/fotos/firma')
        .set('Cookie', [cookieDe(rol)])
        .send({ destino: 'salones' });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe('FORBIDDEN');
    },
  );

  it('responde 400 con un destino que no existe', async () => {
    configurarCloudinary();

    const respuesta = await request(app)
      .post('/api/fotos/firma')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')])
      .send({ destino: 'clientes' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 422 si Cloudinary no está configurado', async () => {
    const respuesta = await request(app)
      .post('/api/fotos/firma')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')])
      .send({ destino: 'salones' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toContain('Falta configurar Cloudinary');
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    configurarCloudinary();

    const sinSesion = await request(app).post('/api/fotos/firma').send({ destino: 'salones' });
    const cliente = await request(app)
      .post('/api/fotos/firma')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ destino: 'salones' });

    expect(sinSesion.status).toBe(401);
    expect(cliente.status).toBe(403);
  });
});
