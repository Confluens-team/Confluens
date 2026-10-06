import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio, no la base: el CI no levanta Postgres (ADR 0003).
vi.mock('./clientes.repositorio.js', () => ({
  listarConResumen: vi.fn(),
}));

const { listarConResumen } = await import('./clientes.repositorio.js');
const listarConResumenMock = vi.mocked(listarConResumen);

const FECHA = new Date('2026-09-29T00:00:00.000Z');

const cookieDe = (rol: 'ADMINISTRADOR_SISTEMA' | 'GERENTE_GENERAL' | 'CLIENTE') =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 9, email: 'admin@confluens.test', rol })}`;

describe('GET /api/clientes', () => {
  const app = crearApp();

  beforeEach(() => {
    listarConResumenMock.mockReset();
  });

  it('con sesión de Administrador del Sistema responde 200 con la cantidad de eventos y solicitudes', async () => {
    listarConResumenMock.mockResolvedValue([
      {
        id: 1,
        nombre: 'Ana Pérez',
        telefono: '3515551234',
        correo: 'ana@empresa.com',
        activo: true,
        usuarioId: 7,
        creadoEn: FECHA,
        actualizadoEn: FECHA,
        _count: { eventos: 2, solicitudes: 3 },
      },
    ] as never);

    const respuesta = await request(app)
      .get('/api/clientes')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([
      expect.objectContaining({ nombre: 'Ana Pérez', cantidadEventos: 2, cantidadSolicitudes: 3 }),
    ]);
    expect(respuesta.body.data[0]).not.toHaveProperty('_count');
  });

  it('sin cookie de sesión responde 401 UNAUTHENTICATED', async () => {
    const respuesta = await request(app).get('/api/clientes');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    expect(listarConResumenMock).not.toHaveBeenCalled();
  });

  // Provisorio (06/10/2026): todo el personal ve todo hasta que se dividan las funciones por rol.
  it('otro rol del personal también accede', async () => {
    listarConResumenMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .get('/api/clientes')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
  });

  it('con sesión de Cliente responde 403 FORBIDDEN', async () => {
    const respuesta = await request(app)
      .get('/api/clientes')
      .set('Cookie', [cookieDe('CLIENTE')]);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(listarConResumenMock).not.toHaveBeenCalled();
  });
});
