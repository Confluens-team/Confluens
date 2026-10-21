import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio, no la base: el CI no levanta Postgres (ADR 0003).
vi.mock('./clientes.repositorio.js', () => ({
  listarConResumen: vi.fn(),
  buscarConResumen: vi.fn(),
  listarEventosDeCliente: vi.fn(),
  contarEventosPorEstado: vi.fn(),
  existeCliente: vi.fn(),
  existeEtiqueta: vi.fn(),
  asignarEtiqueta: vi.fn(),
  existeOtroClienteConCorreo: vi.fn(),
  modificarDatos: vi.fn(),
}));

const {
  listarConResumen,
  buscarConResumen,
  listarEventosDeCliente,
  contarEventosPorEstado,
  existeCliente,
  existeEtiqueta,
  asignarEtiqueta,
  existeOtroClienteConCorreo,
  modificarDatos,
} = await import('./clientes.repositorio.js');
const listarConResumenMock = vi.mocked(listarConResumen);
const buscarConResumenMock = vi.mocked(buscarConResumen);
const listarEventosDeClienteMock = vi.mocked(listarEventosDeCliente);
const contarEventosPorEstadoMock = vi.mocked(contarEventosPorEstado);
const existeClienteMock = vi.mocked(existeCliente);
const existeEtiquetaMock = vi.mocked(existeEtiqueta);
const asignarEtiquetaMock = vi.mocked(asignarEtiqueta);
const existeOtroClienteConCorreoMock = vi.mocked(existeOtroClienteConCorreo);
const modificarDatosMock = vi.mocked(modificarDatos);

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

describe('GET /api/clientes/:id/eventos (HU-18)', () => {
  const app = crearApp();

  const evento = (
    id: number,
    estado: 'EnConsulta' | 'Reservado' | 'Cobrado' | 'Cancelado',
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    fecha: new Date('2026-11-15T00:00:00.000Z'),
    inicio: null,
    fin: null,
    estado,
    tipo: 'Corporativo',
    tipoSocial: null,
    tipoSocialDetalle: null,
    cantidadPersonas: 40,
    salones: [{ salon: { id: 5, nombre: 'Paraná' } }],
    presupuestos: [{ id: id * 10, total: new Prisma.Decimal('100000') }],
    ...extra,
  });

  beforeEach(() => {
    existeClienteMock.mockReset();
    listarEventosDeClienteMock.mockReset();
    contarEventosPorEstadoMock.mockReset();
    existeClienteMock.mockResolvedValue(true);
    listarEventosDeClienteMock.mockResolvedValue([]);
    contarEventosPorEstadoMock.mockResolvedValue([]);
  });

  // CP-18-01: todos los estados, con fecha, tipo, salones, personas, estado y total de cada uno.
  it('devuelve los eventos en cualquier estado con sus datos y el total del presupuesto', async () => {
    listarEventosDeClienteMock.mockResolvedValue([
      evento(4, 'Cancelado'),
      evento(3, 'Cobrado'),
      evento(2, 'Reservado'),
      evento(1, 'EnConsulta'),
    ] as never);

    const respuesta = await request(app)
      .get('/api/clientes/1/eventos')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.eventos.map((e: { estado: string }) => e.estado)).toEqual([
      'Cancelado',
      'Cobrado',
      'Reservado',
      'EnConsulta',
    ]);
    expect(respuesta.body.data.eventos[0]).toEqual({
      id: 4,
      fecha: '2026-11-15',
      inicio: null,
      fin: null,
      estado: 'Cancelado',
      tipo: 'Corporativo',
      tipoSocial: null,
      tipoSocialDetalle: null,
      cantidadPersonas: 40,
      salones: [{ id: 5, nombre: 'Paraná' }],
      presupuestoId: 40,
      total: '100000.00',
    });
  });

  // CP-18-02: la web la muestra como «Sin salón asignado».
  it('una consulta social sin salón viene con la lista de salones vacía', async () => {
    listarEventosDeClienteMock.mockResolvedValue([
      evento(1, 'EnConsulta', { tipo: 'Social', tipoSocial: 'Casamiento', salones: [] }),
    ] as never);

    const respuesta = await request(app)
      .get('/api/clientes/1/eventos')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.body.data.eventos[0]).toMatchObject({
      tipo: 'Social',
      tipoSocial: 'Casamiento',
      salones: [],
    });
  });

  // CP-18-04: los filtros llegan validados al repositorio, que arma la consulta.
  it('pasa los filtros de estado y fechas al repositorio', async () => {
    await request(app)
      .get('/api/clientes/1/eventos?estado=Cobrado,Cancelado&desde=2026-01-01&hasta=2026-12-31')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(listarEventosDeClienteMock).toHaveBeenCalledWith(1, {
      estado: ['Cobrado', 'Cancelado'],
      desde: '2026-01-01',
      hasta: '2026-12-31',
    });
  });

  it('un estado inexistente o un rango invertido responde 400 VALIDATION_ERROR', async () => {
    for (const consulta of ['estado=Confirmado', 'desde=2026-12-31&hasta=2026-01-01']) {
      const respuesta = await request(app)
        .get(`/api/clientes/1/eventos?${consulta}`)
        .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(listarEventosDeClienteMock).not.toHaveBeenCalled();
  });

  // C5: el resumen cuenta todos los eventos del cliente, completa los estados sin eventos con 0.
  it('devuelve el resumen por estado, con cero en los estados sin eventos', async () => {
    contarEventosPorEstadoMock.mockResolvedValue([
      { estado: 'Cobrado', _count: { _all: 2 } },
      { estado: 'Cancelado', _count: { _all: 1 } },
    ] as never);

    const respuesta = await request(app)
      .get('/api/clientes/1/eventos?estado=Cobrado')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(contarEventosPorEstadoMock).toHaveBeenCalledWith(1);
    expect(respuesta.body.data.resumen).toEqual({
      EnConsulta: 0,
      Reservado: 0,
      Cobrado: 2,
      Cancelado: 1,
    });
  });

  // C6: sin eventos la API responde 200 con la lista vacía; la web lo informa.
  it('un cliente sin eventos responde 200 con la lista vacía', async () => {
    const respuesta = await request(app)
      .get('/api/clientes/1/eventos')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.eventos).toEqual([]);
  });

  // CP-18-08
  it('si el cliente no existe responde 404 NOT_FOUND', async () => {
    existeClienteMock.mockResolvedValue(false);

    const respuesta = await request(app)
      .get('/api/clientes/99/eventos')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(listarEventosDeClienteMock).not.toHaveBeenCalled();
  });

  // CP-18-09
  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const sinSesion = await request(app).get('/api/clientes/1/eventos');
    const comoCliente = await request(app)
      .get('/api/clientes/1/eventos')
      .set('Cookie', [cookieDe('CLIENTE')]);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(listarEventosDeClienteMock).not.toHaveBeenCalled();
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

describe('PATCH /api/clientes/:id (HU-17)', () => {
  const app = crearApp();

  const fila = (cambios: Record<string, unknown> = {}) => ({
    id: 1,
    nombre: 'Ana',
    apellido: 'Pérez',
    telefono: '+5493515551234',
    correo: 'ana@empresa.com',
    activo: true,
    usuarioId: null,
    etiquetaId: null,
    etiqueta: null,
    creadoEn: FECHA,
    actualizadoEn: FECHA,
    _count: { eventos: 2, solicitudes: 3 },
    ...cambios,
  });

  const cuerpo = { nombre: 'Ana María', apellido: 'Pérez', telefono: '351 6123456' };
  const modificar = (
    id: number,
    datos: object,
    rol: Parameters<typeof cookieDe>[0] = 'GERENTE_GENERAL',
  ) =>
    request(app)
      .patch(`/api/clientes/${id}`)
      .set('Cookie', [cookieDe(rol)])
      .send(datos);

  beforeEach(() => {
    buscarConResumenMock.mockReset();
    existeOtroClienteConCorreoMock.mockReset();
    modificarDatosMock.mockReset();
    buscarConResumenMock.mockResolvedValue(fila() as never);
    existeOtroClienteConCorreoMock.mockResolvedValue(false);
    modificarDatosMock.mockImplementation((async (_id: number, datos: Record<string, unknown>) =>
      fila(datos)) as never);
  });

  it('modifica nombre y teléfono, guarda el celular en E.164 y no toca el correo', async () => {
    const respuesta = await modificar(1, cuerpo);

    expect(respuesta.status).toBe(200);
    expect(modificarDatosMock).toHaveBeenCalledWith(1, {
      nombre: 'Ana María',
      apellido: 'Pérez',
      telefono: '+5493516123456',
      correo: undefined,
    });
    expect(respuesta.body.data).toMatchObject({
      id: 1,
      cantidadEventos: 2,
      cantidadSolicitudes: 3,
    });
    expect(respuesta.body.data).not.toHaveProperty('_count');
  });

  it('de un cliente sin cuenta cambia también el correo, en minúsculas y sin espacios', async () => {
    const respuesta = await modificar(1, { ...cuerpo, correo: '  Nuevo@Empresa.COM ' });

    expect(respuesta.status).toBe(200);
    expect(existeOtroClienteConCorreoMock).toHaveBeenCalledWith('nuevo@empresa.com', 1);
    expect(modificarDatosMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ correo: 'nuevo@empresa.com' }),
    );
  });

  it('un correo que ya es de otro cliente responde 409 CONFLICT y no guarda nada', async () => {
    existeOtroClienteConCorreoMock.mockResolvedValue(true);

    const respuesta = await modificar(1, { ...cuerpo, correo: 'otro@empresa.com' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(modificarDatosMock).not.toHaveBeenCalled();
  });

  it('cambiar el correo de un cliente con cuenta responde 422 y no guarda nada', async () => {
    buscarConResumenMock.mockResolvedValue(fila({ usuarioId: 7 }) as never);

    const respuesta = await modificar(1, { ...cuerpo, correo: 'otro@empresa.com' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(respuesta.body.error.details).toEqual([expect.objectContaining({ campo: 'correo' })]);
    expect(modificarDatosMock).not.toHaveBeenCalled();
  });

  it('en un cliente con cuenta modifica nombre y teléfono, y mandar su mismo correo no es un cambio', async () => {
    buscarConResumenMock.mockResolvedValue(fila({ usuarioId: 7 }) as never);

    const respuesta = await modificar(1, { ...cuerpo, correo: 'ANA@empresa.com' });

    expect(respuesta.status).toBe(200);
    expect(existeOtroClienteConCorreoMock).not.toHaveBeenCalled();
    expect(modificarDatosMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ correo: undefined }),
    );
  });

  it.each([
    ['sin nombre', { telefono: cuerpo.telefono }, 'nombre'],
    ['con el nombre en blanco', { ...cuerpo, nombre: '   ' }, 'nombre'],
    ['sin teléfono', { nombre: 'Ana' }, 'telefono'],
    ['con un teléfono que no es celular', { ...cuerpo, telefono: '123' }, 'telefono'],
    ['con un correo inválido', { ...cuerpo, correo: 'ana@' }, 'correo'],
  ])('%s responde 400 VALIDATION_ERROR indicando el campo', async (_caso, datos, campo) => {
    const respuesta = await modificar(1, datos);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo })]),
    );
    expect(modificarDatosMock).not.toHaveBeenCalled();
  });

  it('si el cliente no existe responde 404 NOT_FOUND', async () => {
    buscarConResumenMock.mockResolvedValue(null);

    const respuesta = await modificar(99, cuerpo);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(modificarDatosMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const sinSesion = await request(app).patch('/api/clientes/1').send(cuerpo);
    const comoCliente = await modificar(1, cuerpo, 'CLIENTE');

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(modificarDatosMock).not.toHaveBeenCalled();
  });
});
