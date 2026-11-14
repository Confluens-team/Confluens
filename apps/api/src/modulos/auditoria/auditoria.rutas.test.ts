import type { Rol } from '@confluens/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio, no la base: el CI no levanta Postgres (ADR 0003).
vi.mock('./auditoria.repositorio.js', () => ({ listar: vi.fn(), listarCampos: vi.fn() }));

const { listar, listarCampos } = await import('./auditoria.repositorio.js');
const listarMock = vi.mocked(listar);
const listarCamposMock = vi.mocked(listarCampos);

const cookieDe = (rol: Rol) =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 3, email: 'gg@confluens.test', rol })}`;

const fila = {
  id: 10,
  fecha: new Date('2026-11-07T15:00:00.000Z'),
  entidad: 'Servicio',
  entidadId: '4',
  campos: ['precio'],
  valorAnterior: { precio: '1000.00' },
  valorNuevo: { precio: '1200.00' },
  usuario: { id: 3, email: 'gg@confluens.test' },
};

// HU-25 del backlog: la pestaña Auditoría de Configuración de negocio.
describe('GET /api/auditoria', () => {
  const app = crearApp();

  beforeEach(() => {
    listarMock.mockReset();
    listarMock.mockResolvedValue({ filas: [fila], total: 41 } as never);
  });

  it.each(['GERENTE_GENERAL', 'ADMINISTRADOR_SISTEMA'] as const)(
    'el %s ve los cambios con su fecha, usuario, parte, campo y valores, y la paginación',
    async (rol) => {
      const respuesta = await request(app)
        .get('/api/auditoria')
        .set('Cookie', [cookieDe(rol)]);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        data: [{ ...fila, fecha: '2026-11-07T15:00:00.000Z' }],
        meta: { page: 1, pageSize: 20, total: 41 },
      });
      // Primera página por defecto, de a 20.
      expect(listarMock).toHaveBeenCalledWith({}, 0, 20);
    },
  );

  it.each(['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'CLIENTE'] as const)(
    'el %s no la ve: 403',
    async (rol) => {
      const respuesta = await request(app)
        .get('/api/auditoria')
        .set('Cookie', [cookieDe(rol)]);

      expect(respuesta.status).toBe(403);
      expect(listarMock).not.toHaveBeenCalled();
    },
  );

  it('sin sesión responde 401', async () => {
    expect((await request(app).get('/api/auditoria')).status).toBe(401);
  });

  it('filtra por campo auditado, parte del sistema, usuario y fechas del día entero en Córdoba', async () => {
    await request(app)
      .get('/api/auditoria')
      .query({
        campo: 'precio',
        entidad: 'Servicio',
        usuarioId: '3',
        desde: '2026-11-01',
        hasta: '2026-11-07',
        page: '3',
        pageSize: '10',
      })
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(listarMock).toHaveBeenCalledWith(
      {
        campos: { has: 'precio' },
        entidad: 'Servicio',
        usuarioId: 3,
        fecha: {
          gte: new Date('2026-11-01T03:00:00.000Z'),
          lt: new Date('2026-11-08T03:00:00.000Z'),
        },
      },
      20,
      10,
    );
  });

  it('con sistema=true trae solo lo que hizo el Sistema', async () => {
    await request(app)
      .get('/api/auditoria?sistema=true&usuarioId=3')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')]);

    expect(listarMock).toHaveBeenCalledWith({ usuarioId: null }, 0, 20);
  });

  it('los filtros vacíos cuentan como ausentes', async () => {
    await request(app)
      .get('/api/auditoria?campo=&entidad=&desde=')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(listarMock).toHaveBeenCalledWith({}, 0, 20);
  });

  it.each([
    ['una parte del sistema que no existe', 'entidad=Foto'],
    ['hasta antes que desde', 'desde=2026-11-07&hasta=2026-11-01'],
    ['más de 100 por página', 'pageSize=500'],
  ])('rechaza %s con 400', async (_caso, query) => {
    const respuesta = await request(app)
      .get(`/api/auditoria?${query}`)
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auditoria/campos', () => {
  const app = crearApp();

  it('devuelve los campos auditados para el filtro, solo a la gerencia', async () => {
    listarCamposMock.mockResolvedValue(['estado', 'precio']);

    const gg = await request(app)
      .get('/api/auditoria/campos')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);
    const re = await request(app)
      .get('/api/auditoria/campos')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(gg.body).toEqual({ data: ['estado', 'precio'] });
    expect(re.status).toBe(403);
  });
});
