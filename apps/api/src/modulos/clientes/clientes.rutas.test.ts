import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio, no la base: el CI no levanta Postgres (ADR 0003).
vi.mock('./clientes.repositorio.js', () => ({
  listarConResumen: vi.fn(),
  buscarConResumen: vi.fn(),
  existeCliente: vi.fn(),
  existeEtiqueta: vi.fn(),
  asignarEtiqueta: vi.fn(),
}));

const { listarConResumen, buscarConResumen, existeCliente, existeEtiqueta, asignarEtiqueta } =
  await import('./clientes.repositorio.js');
const listarConResumenMock = vi.mocked(listarConResumen);
const buscarConResumenMock = vi.mocked(buscarConResumen);
const existeClienteMock = vi.mocked(existeCliente);
const existeEtiquetaMock = vi.mocked(existeEtiqueta);
const asignarEtiquetaMock = vi.mocked(asignarEtiqueta);

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
        etiquetaId: 4,
        etiqueta: { id: 4, nombre: 'Empresa1' },
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
      expect.objectContaining({
        nombre: 'Ana Pérez',
        etiqueta: { id: 4, nombre: 'Empresa1' },
        cantidadEventos: 2,
        cantidadSolicitudes: 3,
      }),
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

  // CP-16-02 / CP-16-03: la búsqueda llega recortada al repositorio, que arma el filtro por palabra
  // sobre nombre, apellido, correo, teléfono y etiqueta (clientes.repositorio.test.ts).
  it('pasa la búsqueda recortada al repositorio', async () => {
    listarConResumenMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .get('/api/clientes?busqueda=%20%20empresa1%20')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(listarConResumenMock).toHaveBeenCalledWith('empresa1');
  });

  it('una búsqueda vacía cuenta como ausente', async () => {
    listarConResumenMock.mockResolvedValue([]);

    await request(app)
      .get('/api/clientes?busqueda=')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(listarConResumenMock).toHaveBeenCalledWith(undefined);
  });

  it('una búsqueda de más de 100 caracteres responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .get(`/api/clientes?busqueda=${'a'.repeat(101)}`)
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(listarConResumenMock).not.toHaveBeenCalled();
  });

  // CP-16-04 (C3): alfabético por apellido y nombre; la razón social, sin apellido, por su nombre.
  it('ordena por apellido y nombre, con las razones sociales por su nombre', async () => {
    const cliente = (id: number, nombre: string, apellido: string | null) => ({
      id,
      nombre,
      apellido,
      telefono: '+5493515551234',
      correo: `c${id}@mail.test`,
      activo: true,
      usuarioId: null,
      etiquetaId: null,
      etiqueta: null,
      creadoEn: FECHA,
      actualizadoEn: FECHA,
      _count: { eventos: 0, solicitudes: 0 },
    });
    listarConResumenMock.mockResolvedValue([
      cliente(1, 'Zoe', 'Paz'),
      cliente(2, 'Luis', 'álvarez'),
      cliente(3, 'Bodega Norte', null),
      cliente(4, 'Ana', 'Paz'),
    ] as never);

    const respuesta = await request(app)
      .get('/api/clientes')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.body.data.map((c: { id: number }) => c.id)).toEqual([2, 3, 4, 1]);
  });
});

describe('GET /api/clientes/:id', () => {
  const app = crearApp();

  beforeEach(() => {
    buscarConResumenMock.mockReset();
  });

  it('devuelve la ficha del cliente con su etiqueta y sus contadores', async () => {
    buscarConResumenMock.mockResolvedValue({
      id: 1,
      nombre: 'Ana',
      apellido: 'Pérez',
      telefono: '+5493515551234',
      correo: 'ana@empresa.com',
      activo: true,
      usuarioId: 7,
      etiquetaId: 4,
      etiqueta: { id: 4, nombre: 'Empresa1' },
      creadoEn: FECHA,
      actualizadoEn: FECHA,
      _count: { eventos: 2, solicitudes: 1 },
    } as never);

    const respuesta = await request(app)
      .get('/api/clientes/1')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(buscarConResumenMock).toHaveBeenCalledWith(1);
    expect(respuesta.body.data).toMatchObject({
      id: 1,
      etiqueta: { id: 4, nombre: 'Empresa1' },
      cantidadEventos: 2,
      cantidadSolicitudes: 1,
    });
    expect(respuesta.body.data).not.toHaveProperty('_count');
  });

  it('si el cliente no existe responde 404 NOT_FOUND', async () => {
    buscarConResumenMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/clientes/99')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
  });

  it('con sesión de Cliente responde 403 FORBIDDEN', async () => {
    const respuesta = await request(app)
      .get('/api/clientes/1')
      .set('Cookie', [cookieDe('CLIENTE')]);

    expect(respuesta.status).toBe(403);
    expect(buscarConResumenMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/clientes/:id/etiqueta', () => {
  const app = crearApp();

  const clienteConEtiqueta = (etiqueta: { id: number; nombre: string } | null) => ({
    id: 1,
    nombre: 'Ana',
    apellido: 'Pérez',
    telefono: '+5493515551234',
    correo: 'ana@empresa.com',
    activo: true,
    usuarioId: 7,
    etiquetaId: etiqueta?.id ?? null,
    etiqueta,
    creadoEn: FECHA,
    actualizadoEn: FECHA,
    _count: { eventos: 2, solicitudes: 3 },
  });

  beforeEach(() => {
    existeClienteMock.mockReset();
    existeEtiquetaMock.mockReset();
    asignarEtiquetaMock.mockReset();
    existeClienteMock.mockResolvedValue(true);
    existeEtiquetaMock.mockResolvedValue(true);
  });

  it('le asigna la etiqueta y devuelve el cliente con ella', async () => {
    asignarEtiquetaMock.mockResolvedValue(clienteConEtiqueta({ id: 4, nombre: 'Empresa1' }));

    const respuesta = await request(app)
      .patch('/api/clientes/1/etiqueta')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ etiquetaId: 4 });

    expect(respuesta.status).toBe(200);
    expect(asignarEtiquetaMock).toHaveBeenCalledWith(1, 4);
    expect(respuesta.body.data).toMatchObject({
      id: 1,
      etiqueta: { id: 4, nombre: 'Empresa1' },
      cantidadEventos: 2,
    });
    expect(respuesta.body.data).not.toHaveProperty('_count');
  });

  it('con etiquetaId null le quita la etiqueta', async () => {
    asignarEtiquetaMock.mockResolvedValue(clienteConEtiqueta(null));

    const respuesta = await request(app)
      .patch('/api/clientes/1/etiqueta')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ etiquetaId: null });

    expect(respuesta.status).toBe(200);
    expect(asignarEtiquetaMock).toHaveBeenCalledWith(1, null);
    expect(existeEtiquetaMock).not.toHaveBeenCalled();
    expect(respuesta.body.data.etiqueta).toBeNull();
  });

  it('si el cliente no existe responde 404 NOT_FOUND', async () => {
    existeClienteMock.mockResolvedValue(false);

    const respuesta = await request(app)
      .patch('/api/clientes/99/etiqueta')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ etiquetaId: 4 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(asignarEtiquetaMock).not.toHaveBeenCalled();
  });

  it('si la etiqueta no existe responde 404 NOT_FOUND', async () => {
    existeEtiquetaMock.mockResolvedValue(false);

    const respuesta = await request(app)
      .patch('/api/clientes/1/etiqueta')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ etiquetaId: 99 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.message).toBe('No existe la etiqueta');
    expect(asignarEtiquetaMock).not.toHaveBeenCalled();
  });

  it('sin etiquetaId en el cuerpo responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .patch('/api/clientes/1/etiqueta')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('con sesión de Cliente responde 403 FORBIDDEN', async () => {
    const respuesta = await request(app)
      .patch('/api/clientes/1/etiqueta')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ etiquetaId: 4 });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(asignarEtiquetaMock).not.toHaveBeenCalled();
  });
});
