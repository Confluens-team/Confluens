import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio (no la DB real): mismo criterio que auth.rutas.test.ts (HU-27), ver
// ADR 0003 — ci.yml no levanta Postgres para el job de test. vi.mock se hoistea automáticamente
// por encima de los imports de este archivo, así que crearApp() ya usa este mock.
const FECHA = new Date('2026-01-01T00:00:00.000Z');

const distribucionAuditorio = {
  id: 1,
  salonId: 1,
  nombre: 'Conferencia',
  capacidad: 280,
  creadoEn: FECHA,
  actualizadoEn: FECHA,
};

// Auditorio está publicado y Bariloche no: así el mismo fixture sirve para verificar que el
// listado interno los trae a los dos y el público solo al primero (criterio 6 de HU-07).
const auditorio = {
  id: 1,
  nombre: 'Auditorio',
  capacidadMaxima: 280,
  superficie: 289,
  precioJornadaCompleta: '920290.00',
  precioMediaJornada: '830136.00',
  visibleEnLanding: true,
  fotoUrl: null,
  creadoEn: FECHA,
  actualizadoEn: FECHA,
  distribuciones: [distribucionAuditorio],
};

const bariloche = {
  ...auditorio,
  id: 2,
  nombre: 'Bariloche',
  capacidadMaxima: 70,
  superficie: 84,
  visibleEnLanding: false,
  distribuciones: [],
};

vi.mock('./salones.repositorio.js', () => ({
  obtenerSalonesConDistribuciones: vi.fn(),
  obtenerSalonesPublicos: vi.fn(),
  obtenerSalonPorId: vi.fn(),
  actualizarLanding: vi.fn(),
}));

const {
  obtenerSalonesConDistribuciones,
  obtenerSalonesPublicos,
  obtenerSalonPorId,
  actualizarLanding,
} = await import('./salones.repositorio.js');
const obtenerSalonesConDistribucionesMock = vi.mocked(obtenerSalonesConDistribuciones);
const obtenerSalonesPublicosMock = vi.mocked(obtenerSalonesPublicos);
const obtenerSalonPorIdMock = vi.mocked(obtenerSalonPorId);
const actualizarLandingMock = vi.mocked(actualizarLanding);

// Sesión del personal: desde HU-48 estos endpoints piden sesión (C5 y C6).
const cookiePersonal = `${NOMBRE_COOKIE_SESION}=${firmarToken({
  id: 1,
  email: 're@confluens.test',
  rol: 'RESPONSABLE_EVENTOS',
})}`;

describe('GET /api/salones', () => {
  const app = crearApp();

  it('responde 200 con el catálogo de salones y sus distribuciones anidadas', async () => {
    obtenerSalonesConDistribucionesMock.mockResolvedValue([auditorio, bariloche] as never);

    const respuesta = await request(app).get('/api/salones').set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: [
        expect.objectContaining({
          nombre: 'Auditorio',
          capacidadMaxima: 280,
          distribuciones: [expect.objectContaining({ nombre: 'Conferencia', capacidad: 280 })],
        }),
        expect.objectContaining({ nombre: 'Bariloche' }),
      ],
    });
  });

  it('sigue devolviendo los precios al canal interno', async () => {
    obtenerSalonesConDistribucionesMock.mockResolvedValue([auditorio] as never);

    const respuesta = await request(app).get('/api/salones').set('Cookie', [cookiePersonal]);

    expect(respuesta.body.data[0]).toMatchObject({
      precioJornadaCompleta: '920290.00',
      precioMediaJornada: '830136.00',
    });
  });
});

// HU-07. El filtro de visibilidad y el recorte de precios están en el repositorio (un select de
// Prisma), así que acá el mock ya devuelve la forma recortada: lo que se verifica es el contrato
// de la ruta, no la query. Que el select sea el correcto se ve en salones.repositorio.ts.
describe('GET /api/salones/publicos', () => {
  const app = crearApp();

  // Lo que devolvería obtenerSalonesPublicos() con el select de la implementación real.
  const auditorioPublico = {
    id: auditorio.id,
    nombre: auditorio.nombre,
    capacidadMaxima: auditorio.capacidadMaxima,
    superficie: auditorio.superficie,
    fotoUrl: auditorio.fotoUrl,
    distribuciones: auditorio.distribuciones,
  };

  it('responde 200 sin sesión, con los salones publicados y sus distribuciones', async () => {
    obtenerSalonesPublicosMock.mockResolvedValue([auditorioPublico] as never);

    const respuesta = await request(app).get('/api/salones/publicos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([
      expect.objectContaining({
        nombre: 'Auditorio',
        capacidadMaxima: 280,
        superficie: 289,
        distribuciones: [expect.objectContaining({ nombre: 'Conferencia', capacidad: 280 })],
      }),
    ]);
  });

  it('no expone ningún precio (criterio 5)', async () => {
    obtenerSalonesPublicosMock.mockResolvedValue([auditorioPublico] as never);

    const respuesta = await request(app).get('/api/salones/publicos');

    expect(respuesta.body.data[0]).not.toHaveProperty('precioJornadaCompleta');
    expect(respuesta.body.data[0]).not.toHaveProperty('precioMediaJornada');
    // El JSON crudo tampoco los menciona: el precio no viaja por el canal público.
    expect(respuesta.text).not.toContain('920290');
  });

  it('no lista los salones despublicados (criterio 6)', async () => {
    obtenerSalonesPublicosMock.mockResolvedValue([auditorioPublico] as never);

    const respuesta = await request(app).get('/api/salones/publicos');

    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data.map((s: { nombre: string }) => s.nombre)).not.toContain('Bariloche');
  });
});

// HU-08. La escritura en audit_log vive adentro de la transacción del repositorio, que acá está
// mockeado (ADR 0003: sin Postgres en CI), así que lo que se verifica es que el servicio le pase al
// repositorio el usuario de la sesión y los valores previos — que es la parte con lógica. Que la
// fila se escriba en la misma transacción se ve en salones.repositorio.ts.
describe('PATCH /api/salones/:id/landing', () => {
  const app = crearApp();

  const cookieAdmin = `${NOMBRE_COOKIE_SESION}=${firmarToken({
    id: 9,
    email: 'admin@confluens.test',
    rol: 'ADMINISTRADOR_SISTEMA',
  })}`;

  beforeEach(() => {
    obtenerSalonPorIdMock.mockReset();
    actualizarLandingMock.mockReset();
  });

  it('con sesión de Administrador del Sistema responde 200 y despublica el salón', async () => {
    obtenerSalonPorIdMock.mockResolvedValue(auditorio as never);
    actualizarLandingMock.mockResolvedValue({ ...auditorio, visibleEnLanding: false } as never);

    const respuesta = await request(app)
      .patch('/api/salones/1/landing')
      .set('Cookie', [cookieAdmin])
      .send({ visibleEnLanding: false });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ nombre: 'Auditorio', visibleEnLanding: false });
  });

  it('registra el cambio con el usuario de la sesión y el valor anterior (criterio 4)', async () => {
    obtenerSalonPorIdMock.mockResolvedValue(auditorio as never);
    actualizarLandingMock.mockResolvedValue(auditorio as never);

    await request(app)
      .patch('/api/salones/1/landing')
      .set('Cookie', [cookieAdmin])
      .send({ fotoUrl: 'https://ejemplo.test/auditorio.jpg' });

    expect(actualizarLandingMock).toHaveBeenCalledWith(
      1,
      { fotoUrl: 'https://ejemplo.test/auditorio.jpg' },
      // El servicio le pasa el estado previo de los dos campos de landing; el repositorio recorta
      // el valorAnterior a los que el PATCH tocó antes de escribir la fila de audit_log.
      { visibleEnLanding: true, fotoUrl: null },
      // El usuario auditado es el de la cookie de sesión, nunca uno que venga en el body.
      9,
    );
  });

  it('sin cookie de sesión responde 401 UNAUTHENTICATED', async () => {
    const respuesta = await request(app)
      .patch('/api/salones/1/landing')
      .send({ visibleEnLanding: false });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    expect(actualizarLandingMock).not.toHaveBeenCalled();
  });

  // Provisorio (06/10/2026): todo el personal puede editar la landing hasta que se dividan las
  // funciones por rol; el Cliente sigue sin acceso.
  it('con sesión de Cliente responde 403 FORBIDDEN (criterio 5)', async () => {
    const cookieDeCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
      id: 1,
      email: 'cliente@confluens.test',
      rol: 'CLIENTE',
    })}`;

    const respuesta = await request(app)
      .patch('/api/salones/1/landing')
      .set('Cookie', [cookieDeCliente])
      .send({ visibleEnLanding: false });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(actualizarLandingMock).not.toHaveBeenCalled();
  });

  it('con un id inexistente responde 404 NOT_FOUND', async () => {
    obtenerSalonPorIdMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .patch('/api/salones/99/landing')
      .set('Cookie', [cookieAdmin])
      .send({ visibleEnLanding: false });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(actualizarLandingMock).not.toHaveBeenCalled();
  });

  it('con una fotoUrl que no es URL responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .patch('/api/salones/1/landing')
      .set('Cookie', [cookieAdmin])
      .send({ fotoUrl: 'no-es-una-url' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(actualizarLandingMock).not.toHaveBeenCalled();
  });
});

// C5 de HU-48: los precios solo con sesión. Sin sesión, el canal público usa /salones/publicos.
describe('GET /api/salones: permisos (HU-48)', () => {
  const app = crearApp();
  const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
    id: 7,
    email: 'ana@empresa.com',
    rol: 'CLIENTE',
  })}`;

  beforeEach(() => obtenerSalonesConDistribucionesMock.mockReset());

  it('sin sesión responde 401 y no consulta precios', async () => {
    const respuesta = await request(app).get('/api/salones');

    expect(respuesta.status).toBe(401);
    expect(obtenerSalonesConDistribucionesMock).not.toHaveBeenCalled();
  });

  it('con sesión de Cliente responde 200 con los precios', async () => {
    obtenerSalonesConDistribucionesMock.mockResolvedValue([auditorio] as never);

    const respuesta = await request(app).get('/api/salones').set('Cookie', [cookieCliente]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data[0]).toHaveProperty('precioJornadaCompleta');
  });
});
