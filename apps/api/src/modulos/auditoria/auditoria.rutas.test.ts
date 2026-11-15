import type { Rol } from '@confluens/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';
import { filtroDeTipo, filtroPendiente, filtroSensible } from './auditoria.servicio.js';

// Se mockea el repositorio, no la base: el CI no levanta Postgres (ADR 0003).
vi.mock('./auditoria.repositorio.js', () => ({
  listar: vi.fn(),
  contar: vi.fn(),
  agruparPorUsuario: vi.fn(),
  agruparPorEntidad: vi.fn(),
  buscarUsuarios: vi.fn(),
  idsDelEvento: vi.fn(),
  listarTodos: vi.fn(),
  buscarPorId: vi.fn(),
  crearRevision: vi.fn(),
  listarCampos: vi.fn(),
}));

const repo = await import('./auditoria.repositorio.js');
const listarMock = vi.mocked(repo.listar);
const contarMock = vi.mocked(repo.contar);
const listarCamposMock = vi.mocked(repo.listarCampos);

const cookieDe = (rol: Rol, id = 3) =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id, email: 'gg@confluens.test', rol })}`;

// Un cambio de precio de un servicio que hizo la Responsable de Finanzas: sensible y pendiente.
const fila = {
  id: 10,
  fecha: new Date('2026-11-07T15:00:00.000Z'),
  entidad: 'Servicio',
  entidadId: '4',
  campos: ['precio'],
  valorAnterior: { precio: '1000.00' },
  valorNuevo: { precio: '1200.00' },
  usuario: { id: 5, email: 'rf@confluens.test', rol: 'RESPONSABLE_FINANZAS' },
  revision: null,
};
const registro = {
  ...fila,
  fecha: '2026-11-07T15:00:00.000Z',
  tipo: 'modificacion',
  sensible: true,
  requiereRevision: true,
  revision: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  listarMock.mockResolvedValue({ filas: [fila], total: 41 } as never);
  contarMock.mockResolvedValue(0);
});

// HU-25 del backlog: la pestaña Auditoría de Configuración de negocio.
describe('GET /api/auditoria', () => {
  const app = crearApp();

  it.each(['GERENTE_GENERAL', 'ADMINISTRADOR_SISTEMA'] as const)(
    'el %s ve los cambios con su acción, si son sensibles y si esperan revisión, y la paginación',
    async (rol) => {
      contarMock
        .mockResolvedValueOnce(41)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(6);
      const respuesta = await request(app)
        .get('/api/auditoria')
        .set('Cookie', [cookieDe(rol)]);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({
        data: [registro],
        meta: {
          page: 1,
          pageSize: 20,
          total: 41,
          conteos: { todo: 41, alta: 5, modificacion: 30, baja: 6 },
        },
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

  it('filtra por tipo, solo sensibles, un registro puntual y una búsqueda libre', async () => {
    await request(app)
      .get('/api/auditoria?tipo=baja&sensibles=true&entidad=Evento&entidadId=%2373&buscar=rf@')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(listarMock).toHaveBeenCalledWith(
      {
        entidad: 'Evento',
        entidadId: '73',
        AND: [
          filtroDeTipo('baja'),
          filtroSensible(),
          {
            OR: [
              { usuario: { is: { email: { contains: 'rf@', mode: 'insensitive' } } } },
              { entidadId: 'rf@' },
              { campos: { has: 'rf@' } },
            ],
          },
        ],
      },
      0,
      20,
    );
    // Las pestañas cuentan sin el tipo elegido: todo, altas, modificaciones y bajas.
    expect(contarMock).toHaveBeenCalledTimes(4);
  });

  it('con pendientes=true trae lo sensible sin revisar que no hizo la gerencia', async () => {
    await request(app)
      .get('/api/auditoria?pendientes=true&sensibles=true')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(listarMock).toHaveBeenCalledWith({ AND: [filtroPendiente()] }, 0, 20);
  });

  it('un cambio sensible del GG o del Sistema no espera revisión', async () => {
    listarMock.mockResolvedValue({
      filas: [
        { ...fila, id: 11, usuario: { id: 3, email: 'gg@confluens.test', rol: 'GERENTE_GENERAL' } },
        { ...fila, id: 12, usuario: null },
      ],
      total: 2,
    } as never);

    const respuesta = await request(app)
      .get('/api/auditoria')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.body.data).toMatchObject([
      { id: 11, sensible: true, requiereRevision: false },
      { id: 12, sensible: true, requiereRevision: false },
    ]);
  });

  it('los filtros vacíos cuentan como ausentes', async () => {
    await request(app)
      .get('/api/auditoria?campo=&entidad=&desde=&tipo=&buscar=')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(listarMock).toHaveBeenCalledWith({}, 0, 20);
  });

  it.each([
    ['una parte del sistema que no existe', 'entidad=Foto'],
    ['hasta antes que desde', 'desde=2026-11-07&hasta=2026-11-01'],
    ['más de 100 por página', 'pageSize=500'],
    ['un tipo que no existe', 'tipo=borrado'],
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

describe('GET /api/auditoria/resumen', () => {
  const app = crearApp();

  it('resume los últimos 7 días: cambios, pendientes, bajas, personas y el Sistema', async () => {
    contarMock
      .mockResolvedValueOnce(214) // cambios del período
      .mockResolvedValueOnce(181) // del período anterior
      .mockResolvedValueOnce(4) // sensibles pendientes
      .mockResolvedValueOnce(7) // bajas
      .mockResolvedValueOnce(2); // bajas de pagos
    vi.mocked(repo.agruparPorUsuario).mockResolvedValue([
      { usuarioId: 5, cambios: 31 },
      { usuarioId: null, cambios: 40 },
      { usuarioId: 1, cambios: 72 },
    ]);
    vi.mocked(repo.agruparPorEntidad).mockResolvedValue([
      { entidad: 'Pago', cambios: 34 },
      { entidad: 'Evento', cambios: 88 },
    ]);
    vi.mocked(repo.buscarUsuarios).mockResolvedValue([
      { id: 1, email: 're@confluens.test', rol: 'RESPONSABLE_EVENTOS' },
      { id: 5, email: 'rf@confluens.test', rol: 'RESPONSABLE_FINANZAS' },
    ] as never);

    const respuesta = await request(app)
      .get('/api/auditoria/resumen')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      dias: 7,
      cambios: 214,
      cambiosPeriodoAnterior: 181,
      sensiblesPendientes: 4,
      bajas: 7,
      bajasDePagos: 2,
      personas: 2,
      automaticos: 40,
      porEntidad: [
        { entidad: 'Evento', cambios: 88 },
        { entidad: 'Pago', cambios: 34 },
      ],
      paraRevisar: [registro],
    });
    expect(respuesta.body.data.porPersona.map((p: { cambios: number }) => p.cambios)).toEqual([
      72, 40, 31,
    ]);
    // «Para revisar»: los 10 pendientes más nuevos.
    expect(listarMock).toHaveBeenCalledWith(filtroPendiente(), 0, 10);
  });

  it('el Responsable de Eventos no lo ve', async () => {
    const respuesta = await request(app)
      .get('/api/auditoria/resumen')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);
    expect(respuesta.status).toBe(403);
  });
});

describe('GET /api/auditoria/evento/:id', () => {
  const app = crearApp();

  it('junta los cambios del evento, sus presupuestos, sus pagos y su solicitud', async () => {
    vi.mocked(repo.idsDelEvento).mockResolvedValue({
      presupuestos: [65],
      pagos: [7, 8],
      solicitudes: [],
    });
    vi.mocked(repo.listarTodos).mockResolvedValue([fila] as never);

    const respuesta = await request(app)
      .get('/api/auditoria/evento/73')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([registro]);
    expect(repo.listarTodos).toHaveBeenCalledWith(
      {
        OR: [
          { entidad: 'Evento', entidadId: '73' },
          { entidad: 'Presupuesto', entidadId: { in: ['65'] } },
          { entidad: 'Pago', entidadId: { in: ['7', '8'] } },
        ],
      },
      1000,
    );
  });

  it('un evento que no existe responde 404', async () => {
    vi.mocked(repo.idsDelEvento).mockResolvedValue(null);
    const respuesta = await request(app)
      .get('/api/auditoria/evento/999')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);
    expect(respuesta.status).toBe(404);
  });
});

describe('POST /api/auditoria/:id/revision', () => {
  const app = crearApp();
  const revisar = (rol: Rol = 'GERENTE_GENERAL') =>
    request(app)
      .post('/api/auditoria/10/revision')
      .set('Cookie', [cookieDe(rol)]);

  it('el GG marca como revisado un cambio sensible de otro usuario', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(fila as never);
    vi.mocked(repo.crearRevision).mockResolvedValue({
      auditLogId: 10,
      revisadoEn: new Date('2026-11-15T20:00:00.000Z'),
      revisadoPor: { id: 3, email: 'gg@confluens.test' },
    });

    const respuesta = await revisar();

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toEqual({
      auditLogId: 10,
      usuario: { id: 3, email: 'gg@confluens.test' },
      fecha: '2026-11-15T20:00:00.000Z',
    });
    expect(repo.crearRevision).toHaveBeenCalledWith(10, 3);
  });

  it('el ADM ve la auditoría pero no revisa: 403', async () => {
    expect((await revisar('ADMINISTRADOR_SISTEMA')).status).toBe(403);
    expect(repo.crearRevision).not.toHaveBeenCalled();
  });

  it('un cambio que no existe responde 404', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(null);
    expect((await revisar()).status).toBe(404);
  });

  it('un cambio ya revisado responde 409', async () => {
    vi.mocked(repo.buscarPorId).mockResolvedValue({
      ...fila,
      revision: {
        revisadoEn: new Date('2026-11-14T10:00:00.000Z'),
        revisadoPor: { id: 3, email: 'gg@confluens.test' },
      },
    } as never);
    expect((await revisar()).status).toBe(409);
  });

  it.each([
    ['no es sensible', { ...fila, entidad: 'Evento', campos: ['estado'] }],
    [
      'lo hizo el GG',
      { ...fila, usuario: { id: 3, email: 'gg@confluens.test', rol: 'GERENTE_GENERAL' } },
    ],
    ['lo hizo el Sistema', { ...fila, usuario: null }],
  ])('responde 422 si %s', async (_caso, cambio) => {
    vi.mocked(repo.buscarPorId).mockResolvedValue(cambio as never);

    const respuesta = await revisar();

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(repo.crearRevision).not.toHaveBeenCalled();
  });
});

describe('GET /api/auditoria/exportar', () => {
  const app = crearApp();

  it('descarga los cambios filtrados en CSV', async () => {
    vi.mocked(repo.listarTodos).mockResolvedValue([fila] as never);

    const respuesta = await request(app)
      .get('/api/auditoria/exportar?entidad=Servicio')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toContain('text/csv');
    expect(respuesta.headers['content-disposition']).toContain('auditoria.csv');
    const [encabezado, linea] = respuesta.text.replace(/^\uFEFF/, '').split('\n');
    expect(encabezado).toContain('fecha,usuario,rol,accion');
    expect(linea).toContain('rf@confluens.test,RESPONSABLE_FINANZAS,modificacion,Servicio,4');
    expect(repo.listarTodos).toHaveBeenCalledWith({ entidad: 'Servicio' }, 5000);
  });
});
