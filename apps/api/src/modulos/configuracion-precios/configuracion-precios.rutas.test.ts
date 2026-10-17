import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

vi.mock('./configuracion-precios.repositorio.js', () => ({
  obtener: vi.fn(),
  guardar: vi.fn(),
}));

const repo = await import('./configuracion-precios.repositorio.js');
const obtenerMock = vi.mocked(repo.obtener);
const guardarMock = vi.mocked(repo.guardar);

const app = crearApp();

function cookieDe(rol: 'RESPONSABLE_EVENTOS' | 'CLIENTE') {
  return `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email: 'alguien@confluens.test', rol })}`;
}

const fila = (porcentaje: string) => ({
  id: 1,
  porcentajeMensual: new Prisma.Decimal(porcentaje),
  actualizadoEn: new Date('2026-10-16T15:00:00.000Z'),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/configuracion-precios (RN-13)', () => {
  it('lo lee también el cliente, que proyecta los precios en el cotizador', async () => {
    obtenerMock.mockResolvedValue(fila('2.5'));

    const respuesta = await request(app)
      .get('/api/configuracion-precios')
      .set('Cookie', [cookieDe('CLIENTE')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      porcentajeMensual: '2.50',
      actualizadoEn: '2026-10-16T15:00:00.000Z',
    });
  });

  it('sin la fila, el porcentaje es 0', async () => {
    obtenerMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/configuracion-precios')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.body.data.porcentajeMensual).toBe('0.00');
  });

  it('exige sesión', async () => {
    const respuesta = await request(app).get('/api/configuracion-precios');

    expect(respuesta.status).toBe(401);
  });
});

describe('PUT /api/configuracion-precios (RN-10)', () => {
  it('el personal cambia el porcentaje', async () => {
    guardarMock.mockResolvedValue(fila('3'));

    const respuesta = await request(app)
      .put('/api/configuracion-precios')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
      .send({ porcentajeMensual: '3' });

    expect(respuesta.status).toBe(200);
    expect(guardarMock).toHaveBeenCalledWith('3');
    expect(respuesta.body.data.porcentajeMensual).toBe('3.00');
  });

  it('responde 400 con un porcentaje mayor a 100 o mal escrito', async () => {
    for (const porcentajeMensual of ['101', '-1', '2,5', '1.234']) {
      const respuesta = await request(app)
        .put('/api/configuracion-precios')
        .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
        .send({ porcentajeMensual });
      expect(respuesta.status).toBe(400);
    }
    expect(guardarMock).not.toHaveBeenCalled();
  });

  it('el cliente no lo puede cambiar', async () => {
    const respuesta = await request(app)
      .put('/api/configuracion-precios')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ porcentajeMensual: '3' });

    expect(respuesta.status).toBe(403);
  });
});
