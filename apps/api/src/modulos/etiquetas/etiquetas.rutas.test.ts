import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio, no la base: el CI no levanta Postgres (ADR 0003).
vi.mock('./etiquetas.repositorio.js', () => ({
  listar: vi.fn(),
  buscarPorNombre: vi.fn(),
  crear: vi.fn(),
}));

const { listar, buscarPorNombre, crear } = await import('./etiquetas.repositorio.js');
const listarMock = vi.mocked(listar);
const buscarPorNombreMock = vi.mocked(buscarPorNombre);
const crearMock = vi.mocked(crear);

const cookieDe = (rol: 'RESPONSABLE_EVENTOS' | 'CLIENTE') =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 9, email: 'fran@confluens.test', rol })}`;

describe('/api/etiquetas', () => {
  const app = crearApp();

  beforeEach(() => {
    listarMock.mockReset();
    buscarPorNombreMock.mockReset();
    crearMock.mockReset();
  });

  it('GET lista las etiquetas para el personal', async () => {
    listarMock.mockResolvedValue([{ id: 4, nombre: 'Empresa1' }]);

    const respuesta = await request(app)
      .get('/api/etiquetas')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: [{ id: 4, nombre: 'Empresa1' }] });
  });

  it('POST crea la etiqueta con el nombre recortado y responde 201', async () => {
    buscarPorNombreMock.mockResolvedValue(null);
    crearMock.mockResolvedValue({ id: 5, nombre: 'Empresa2' });

    const respuesta = await request(app)
      .post('/api/etiquetas')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
      .send({ nombre: '  Empresa2  ' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ data: { id: 5, nombre: 'Empresa2' } });
    expect(crearMock).toHaveBeenCalledWith('Empresa2');
  });

  it('POST con un nombre que ya existe (sin distinguir mayúsculas) responde 409 CONFLICT', async () => {
    buscarPorNombreMock.mockResolvedValue({ id: 4, nombre: 'Empresa1' });

    const respuesta = await request(app)
      .post('/api/etiquetas')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
      .send({ nombre: 'empresa1' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('POST con el nombre vacío responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/etiquetas')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
      .send({ nombre: '   ' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('con sesión de CLIENTE responde 403: la etiqueta es solo del personal', async () => {
    const respuesta = await request(app)
      .get('/api/etiquetas')
      .set('Cookie', [cookieDe('CLIENTE')]);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(listarMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 UNAUTHENTICATED', async () => {
    const respuesta = await request(app).post('/api/etiquetas').send({ nombre: 'Empresa3' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });
});
