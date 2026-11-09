import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
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
  activo: true,
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
  buscarDistribucionPorNombre: vi.fn(),
  crearDistribucion: vi.fn(),
  modificarSalon: vi.fn(),
  buscarDistribucionPorId: vi.fn(),
  modificarDistribucion: vi.fn(),
  cambiarEstadoDistribucion: vi.fn(),
}));

const {
  obtenerSalonesConDistribuciones,
  obtenerSalonesPublicos,
  obtenerSalonPorId,
  actualizarLanding,
  buscarDistribucionPorNombre,
  crearDistribucion,
  modificarSalon,
  buscarDistribucionPorId,
  modificarDistribucion,
  cambiarEstadoDistribucion,
} = await import('./salones.repositorio.js');
const obtenerSalonesConDistribucionesMock = vi.mocked(obtenerSalonesConDistribuciones);
const obtenerSalonesPublicosMock = vi.mocked(obtenerSalonesPublicos);
const obtenerSalonPorIdMock = vi.mocked(obtenerSalonPorId);
const actualizarLandingMock = vi.mocked(actualizarLanding);
const buscarDistribucionPorNombreMock = vi.mocked(buscarDistribucionPorNombre);
const crearDistribucionMock = vi.mocked(crearDistribucion);
const modificarSalonMock = vi.mocked(modificarSalon);
const buscarDistribucionPorIdMock = vi.mocked(buscarDistribucionPorId);
const modificarDistribucionMock = vi.mocked(modificarDistribucion);
const cambiarEstadoDistribucionMock = vi.mocked(cambiarEstadoDistribucion);

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

// HU-25. Las tres reglas (salón existente, nombre sin repetir y capacidad dentro de la del salón)
// viven en el servicio y se cortan antes de escribir, así que en cada rechazo se verifica también
// que no se llamó a crearDistribucion.
describe('POST /api/salones/:id/distribuciones (HU-25)', () => {
  const app = crearApp();

  const alta = (cuerpo: object, cookie = cookiePersonal) =>
    request(app).post('/api/salones/1/distribuciones').set('Cookie', [cookie]).send(cuerpo);

  beforeEach(() => {
    obtenerSalonPorIdMock.mockReset();
    buscarDistribucionPorNombreMock.mockReset();
    crearDistribucionMock.mockReset();
    obtenerSalonPorIdMock.mockResolvedValue(auditorio as never);
    buscarDistribucionPorNombreMock.mockResolvedValue(null);
    crearDistribucionMock.mockImplementation(
      async (salonId, datos) => ({ ...distribucionAuditorio, id: 16, salonId, ...datos }) as never,
    );
  });

  it('crea la distribución en el salón con el nombre recortado y responde 201', async () => {
    const respuesta = await alta({ nombre: '  Banquete ', capacidad: 200 });

    expect(respuesta.status).toBe(201);
    expect(crearDistribucionMock).toHaveBeenCalledWith(1, { nombre: 'Banquete', capacidad: 200 });
    expect(respuesta.body.data).toMatchObject({
      id: 16,
      salonId: 1,
      nombre: 'Banquete',
      capacidad: 200,
    });
  });

  it('acepta una capacidad igual a la capacidad máxima del salón', async () => {
    const respuesta = await alta({ nombre: 'Auditorio completo', capacidad: 280 });

    expect(respuesta.status).toBe(201);
  });

  it('acepta el borde de abajo (capacidad 1) y un nombre de exactamente 40 caracteres', async () => {
    const respuesta = await alta({ nombre: 'a'.repeat(40), capacidad: 1 });

    expect(respuesta.status).toBe(201);
    expect(crearDistribucionMock).toHaveBeenCalledWith(1, { nombre: 'a'.repeat(40), capacidad: 1 });
  });

  it('un nombre de 41 caracteres responde 400 con el campo nombre', async () => {
    const respuesta = await alta({ nombre: 'a'.repeat(41), capacidad: 50 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('nombre');
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('el nombre con HTML responde 400: el middleware rechazar-html corta en la entrada', async () => {
    const respuesta = await alta({ nombre: '<b>Banquete</b>', capacidad: 50 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('nombre');
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('acepta un nombre con tildes, ñ y números, y lo guarda tal cual', async () => {
    const respuesta = await alta({ nombre: 'Peña 2º piso', capacidad: 50 });

    expect(respuesta.status).toBe(201);
    expect(crearDistribucionMock).toHaveBeenCalledWith(1, {
      nombre: 'Peña 2º piso',
      capacidad: 50,
    });
  });

  it('la capacidad que no es un número finito o es nula responde 400', async () => {
    // Infinity viaja como null en el JSON.
    for (const capacidad of [null, 'abc', [], {}, true, Number.POSITIVE_INFINITY]) {
      const respuesta = await alta({ nombre: 'Banquete', capacidad });
      expect(respuesta.status, JSON.stringify(capacidad)).toBe(400);
    }
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('una capacidad enorme se rechaza con 422, no se guarda', async () => {
    const respuesta = await alta({ nombre: 'Banquete', capacidad: 2_000_000_000 });

    expect(respuesta.status).toBe(422);
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('un nombre que ya ocupa una distribución dada de baja también responde 409', async () => {
    // La dada de baja sigue ocupando su nombre en el salón: la búsqueda no filtra por activo.
    buscarDistribucionPorNombreMock.mockResolvedValue({
      ...distribucionAuditorio,
      activo: false,
    } as never);

    const respuesta = await alta({ nombre: 'Conferencia', capacidad: 100 });

    expect(respuesta.status).toBe(409);
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  // Dos altas simultáneas con el mismo nombre pasan la búsqueda previa y la segunda choca con el
  // índice único (salonId, nombre) de la base. Tiene que ser un 409, no un 500.
  it('dos altas simultáneas con el mismo nombre: el índice único responde 409, no 500', async () => {
    crearDistribucionMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const respuesta = await alta({ nombre: 'Banquete', capacidad: 50 });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(respuesta.body.error.message).toContain('Banquete');
  });

  it('el body no puede fijar el salón ni el estado de la distribución', async () => {
    await alta({ nombre: 'Banquete', capacidad: 50, salonId: 2, activo: false, id: 99 });

    expect(crearDistribucionMock).toHaveBeenCalledWith(1, { nombre: 'Banquete', capacidad: 50 });
  });

  it('sin nombre o con el nombre solo con espacios responde 400 VALIDATION_ERROR', async () => {
    for (const cuerpo of [{ capacidad: 50 }, { nombre: '   ', capacidad: 50 }]) {
      const respuesta = await alta(cuerpo);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
      expect(respuesta.body.error.details[0].campo).toBe('nombre');
    }
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('sin capacidad, con cero, negativa o con decimales responde 400 VALIDATION_ERROR', async () => {
    for (const capacidad of [undefined, 0, -10, 12.5, '50']) {
      const respuesta = await alta({ nombre: 'Banquete', capacidad });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.details[0].campo).toBe('capacidad');
    }
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('un nombre que ya tiene el salón, con otras mayúsculas, responde 409 CONFLICT', async () => {
    buscarDistribucionPorNombreMock.mockResolvedValue(distribucionAuditorio as never);

    const respuesta = await alta({ nombre: 'conferencia', capacidad: 100 });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    // La búsqueda es dentro del salón: otro salón puede tener una distribución con el mismo nombre.
    expect(buscarDistribucionPorNombreMock).toHaveBeenCalledWith(1, 'conferencia');
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('una capacidad mayor que la del salón responde 422 BUSINESS_RULE_VIOLATION', async () => {
    const respuesta = await alta({ nombre: 'Banquete', capacidad: 281 });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(respuesta.body.error.details[0].campo).toBe('capacidad');
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('con un salón inexistente responde 404 NOT_FOUND', async () => {
    obtenerSalonPorIdMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/salones/99/distribuciones')
      .set('Cookie', [cookiePersonal])
      .send({ nombre: 'Banquete', capacidad: 50 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });

  it('con un id de salón que no es número responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/salones/abc/distribuciones')
      .set('Cookie', [cookiePersonal])
      .send({ nombre: 'Banquete', capacidad: 50 });

    expect(respuesta.status).toBe(400);
    expect(obtenerSalonPorIdMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
      id: 7,
      email: 'ana@empresa.com',
      rol: 'CLIENTE',
    })}`;

    const sinSesion = await request(app)
      .post('/api/salones/1/distribuciones')
      .send({ nombre: 'Banquete', capacidad: 50 });
    const comoCliente = await alta({ nombre: 'Banquete', capacidad: 50 }, cookieCliente);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(crearDistribucionMock).not.toHaveBeenCalled();
  });
});

// HU-26 del Sprint 4. Del salón se modifican solo los precios: la capacidad máxima y la superficie
// son fijas (equipo, 03/11/2026). Las distribuciones se editan aparte, en el describe de abajo.
describe('PATCH /api/salones/:id (HU-26)', () => {
  const app = crearApp();

  const cuerpoValido = { precioJornadaCompleta: '950000.00', precioMediaJornada: '850000.00' };

  const modificar = (cuerpo: object, cookie = cookiePersonal, id = 1) =>
    request(app).patch(`/api/salones/${id}`).set('Cookie', [cookie]).send(cuerpo);

  beforeEach(() => {
    obtenerSalonPorIdMock.mockReset();
    modificarSalonMock.mockReset();
    obtenerSalonPorIdMock.mockResolvedValue(auditorio as never);
    modificarSalonMock.mockImplementation(
      async (_id, datos) => ({ ...auditorio, ...datos }) as never,
    );
  });

  it('modifica los precios y responde 200 con el salón y sus distribuciones', async () => {
    const respuesta = await modificar(cuerpoValido);

    expect(respuesta.status).toBe(200);
    expect(modificarSalonMock).toHaveBeenCalledWith(1, cuerpoValido);
    expect(respuesta.body.data).toMatchObject({
      nombre: 'Auditorio',
      capacidadMaxima: 280,
      precioJornadaCompleta: '950000.00',
      distribuciones: [expect.objectContaining({ nombre: 'Conferencia' })],
    });
  });

  it('no permite cambiar el nombre, la capacidad máxima ni la superficie: se ignoran', async () => {
    await modificar({
      ...cuerpoValido,
      nombre: 'Otro nombre',
      capacidadMaxima: 500,
      superficie: 1000,
    });

    expect(modificarSalonMock).toHaveBeenCalledWith(1, cuerpoValido);
  });

  it('un precio en cero o con formato inválido responde 400', async () => {
    for (const cambio of [
      { precioJornadaCompleta: '0' },
      { precioMediaJornada: '0.00' },
      { precioJornadaCompleta: '12,50' },
      { precioMediaJornada: undefined },
    ]) {
      const respuesta = await modificar({ ...cuerpoValido, ...cambio });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.details[0].campo).toBe(Object.keys(cambio)[0]);
    }
    expect(modificarSalonMock).not.toHaveBeenCalled();
  });

  // Los precios viajan como texto de importe: hasta 10 dígitos y 2 decimales, mayores que cero.
  it.each([
    ['negativo', '-950000.00'],
    ['con tres decimales', '950000.123'],
    ['de más de 10 dígitos', '12345678901'],
    ['en notación científica', '1e6'],
    ['"Infinity"', 'Infinity'],
    ['vacío', ''],
    ['nulo', null],
    ['numérico en lugar de texto', 950000],
  ])('un precio %s responde 400 y no escribe', async (_caso, valor) => {
    const jornada = await modificar({ ...cuerpoValido, precioJornadaCompleta: valor });
    const media = await modificar({ ...cuerpoValido, precioMediaJornada: valor });

    expect(jornada.status).toBe(400);
    expect(jornada.body.error.details[0].campo).toBe('precioJornadaCompleta');
    expect(media.status).toBe(400);
    expect(media.body.error.details[0].campo).toBe('precioMediaJornada');
    expect(modificarSalonMock).not.toHaveBeenCalled();
  });

  it('un body vacío o sin uno de los dos precios responde 400: viajan los dos', async () => {
    for (const cuerpo of [{}, { precioJornadaCompleta: '950000' }, { precioMediaJornada: '1' }]) {
      const respuesta = await modificar(cuerpo);
      expect(respuesta.status).toBe(400);
    }
    expect(modificarSalonMock).not.toHaveBeenCalled();
  });

  it('acepta el precio mínimo (un centavo) y el máximo que entra en el formato', async () => {
    const minimo = await modificar({ precioJornadaCompleta: '0.01', precioMediaJornada: '0.01' });
    const maximo = await modificar({
      precioJornadaCompleta: '9999999999.99',
      precioMediaJornada: '9999999999.99',
    });

    expect(minimo.status).toBe(200);
    expect(maximo.status).toBe(200);
  });

  it('un precio de media jornada mayor que el de jornada completa se acepta: no hay regla que lo ligue', async () => {
    const respuesta = await modificar({
      precioJornadaCompleta: '100.00',
      precioMediaJornada: '200.00',
    });

    expect(respuesta.status).toBe(200);
  });

  it('con un id de salón que no es número positivo responde 400', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const respuesta = await request(app)
        .patch(`/api/salones/${id}`)
        .set('Cookie', [cookiePersonal])
        .send(cuerpoValido);
      expect(respuesta.status, id).toBe(400);
    }
    expect(modificarSalonMock).not.toHaveBeenCalled();
  });

  it('con un salón inexistente responde 404 sin escribir', async () => {
    obtenerSalonPorIdMock.mockResolvedValue(null);

    const respuesta = await modificar(cuerpoValido, cookiePersonal, 99);

    expect(respuesta.status).toBe(404);
    expect(modificarSalonMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
      id: 7,
      email: 'ana@empresa.com',
      rol: 'CLIENTE',
    })}`;

    const sinSesion = await request(app).patch('/api/salones/1').send(cuerpoValido);
    const comoCliente = await modificar(cuerpoValido, cookieCliente);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(modificarSalonMock).not.toHaveBeenCalled();
  });
});

// HU-26 del Sprint 4: edición de una distribución, con las mismas reglas que el alta (HU-25). En
// cada rechazo se verifica que no se llamó a modificarDistribucion.
describe('PATCH /api/salones/:id/distribuciones/:distribucionId (HU-26)', () => {
  const app = crearApp();

  const editar = (
    cuerpo: object,
    ruta = '/api/salones/1/distribuciones/1',
    cookie = cookiePersonal,
  ) => request(app).patch(ruta).set('Cookie', [cookie]).send(cuerpo);

  beforeEach(() => {
    obtenerSalonPorIdMock.mockReset();
    buscarDistribucionPorIdMock.mockReset();
    buscarDistribucionPorNombreMock.mockReset();
    modificarDistribucionMock.mockReset();
    obtenerSalonPorIdMock.mockResolvedValue(auditorio as never);
    buscarDistribucionPorIdMock.mockResolvedValue(distribucionAuditorio as never);
    buscarDistribucionPorNombreMock.mockResolvedValue(null);
    modificarDistribucionMock.mockImplementation(
      async (id, datos) => ({ ...distribucionAuditorio, id, ...datos }) as never,
    );
  });

  it('modifica nombre y capacidad y responde 200 con la distribución', async () => {
    const respuesta = await editar({ nombre: ' Conferencia grande ', capacidad: 250 });

    expect(respuesta.status).toBe(200);
    expect(modificarDistribucionMock).toHaveBeenCalledWith(1, {
      nombre: 'Conferencia grande',
      capacidad: 250,
    });
    expect(respuesta.body.data).toMatchObject({ id: 1, salonId: 1, capacidad: 250 });
  });

  it('dos renombres simultáneos al mismo nombre: el índice único responde 409, no 500', async () => {
    modificarDistribucionMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const respuesta = await editar({ nombre: 'Banquete', capacidad: 200 });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(respuesta.body.error.message).toContain('Banquete');
  });

  it('acepta su propio nombre, también con otras mayúsculas', async () => {
    buscarDistribucionPorNombreMock.mockResolvedValue(distribucionAuditorio as never);

    const respuesta = await editar({ nombre: 'CONFERENCIA', capacidad: 200 });

    expect(respuesta.status).toBe(200);
    expect(modificarDistribucionMock).toHaveBeenCalled();
  });

  it('el nombre de otra distribución del salón responde 409 CONFLICT', async () => {
    buscarDistribucionPorNombreMock.mockResolvedValue({
      ...distribucionAuditorio,
      id: 2,
      nombre: 'Banquete',
    } as never);

    const respuesta = await editar({ nombre: 'banquete', capacidad: 200 });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(buscarDistribucionPorNombreMock).toHaveBeenCalledWith(1, 'banquete');
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });

  it('una capacidad mayor que la del salón responde 422 BUSINESS_RULE_VIOLATION', async () => {
    const respuesta = await editar({ nombre: 'Conferencia', capacidad: 281 });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.details[0].campo).toBe('capacidad');
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });

  it('nombre vacío o capacidad inválida responden 400 VALIDATION_ERROR', async () => {
    for (const cuerpo of [
      { nombre: '   ', capacidad: 50 },
      { nombre: 'Conferencia', capacidad: 0 },
      { nombre: 'Conferencia', capacidad: 12.5 },
    ]) {
      const respuesta = await editar(cuerpo);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });

  it('acepta el borde de abajo y el de arriba: capacidad 1 y la capacidad exacta del salón', async () => {
    const minima = await editar({ nombre: 'Conferencia', capacidad: 1 });
    const maxima = await editar({ nombre: 'Conferencia', capacidad: 280 });

    expect(minima.status).toBe(200);
    expect(maxima.status).toBe(200);
  });

  it('un nombre de 40 caracteres entra y uno de 41 responde 400', async () => {
    const justo = await editar({ nombre: 'a'.repeat(40), capacidad: 50 });
    const largo = await editar({ nombre: 'a'.repeat(41), capacidad: 50 });

    expect(justo.status).toBe(200);
    expect(largo.status).toBe(400);
    expect(largo.body.error.details[0].campo).toBe('nombre');
  });

  it('el nombre con HTML responde 400 y no escribe', async () => {
    const respuesta = await editar({ nombre: '<img src=x>', capacidad: 50 });

    expect(respuesta.status).toBe(400);
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });

  it('un body sin nombre, sin capacidad o vacío responde 400: viaja el estado completo', async () => {
    for (const cuerpo of [{}, { nombre: 'Conferencia' }, { capacidad: 50 }]) {
      const respuesta = await editar(cuerpo);
      expect(respuesta.status).toBe(400);
    }
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });

  it('no cambia el salón ni el estado de la distribución, aunque el body los mande', async () => {
    await editar({ nombre: 'Conferencia', capacidad: 50, salonId: 2, activo: false });

    expect(modificarDistribucionMock).toHaveBeenCalledWith(1, {
      nombre: 'Conferencia',
      capacidad: 50,
    });
  });

  it('se puede modificar una distribución dada de baja: el nombre propio no choca', async () => {
    const dadaDeBaja = { ...distribucionAuditorio, activo: false };
    buscarDistribucionPorIdMock.mockResolvedValue(dadaDeBaja as never);
    buscarDistribucionPorNombreMock.mockResolvedValue(dadaDeBaja as never);

    const respuesta = await editar({ nombre: 'Conferencia', capacidad: 100 });

    expect(respuesta.status).toBe(200);
  });

  it('con ids que no son enteros positivos responde 400', async () => {
    for (const ruta of [
      '/api/salones/1/distribuciones/0',
      '/api/salones/1/distribuciones/-1',
      '/api/salones/1/distribuciones/1.5',
      '/api/salones/0/distribuciones/1',
    ]) {
      const respuesta = await editar({ nombre: 'Conferencia', capacidad: 50 }, ruta);
      expect(respuesta.status, ruta).toBe(400);
    }
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });

  it('una distribución de otro salón o inexistente responde 404 NOT_FOUND', async () => {
    buscarDistribucionPorIdMock.mockResolvedValueOnce({
      ...distribucionAuditorio,
      salonId: 2,
    } as never);
    const deOtroSalon = await editar({ nombre: 'Conferencia', capacidad: 50 });

    buscarDistribucionPorIdMock.mockResolvedValueOnce(null);
    const inexistente = await editar(
      { nombre: 'Conferencia', capacidad: 50 },
      '/api/salones/1/distribuciones/99',
    );

    expect(deOtroSalon.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });

  it('con un salón inexistente responde 404 y con ids que no son número, 400', async () => {
    obtenerSalonPorIdMock.mockResolvedValue(null);
    const sinSalon = await editar(
      { nombre: 'Conferencia', capacidad: 50 },
      '/api/salones/99/distribuciones/1',
    );
    const idInvalido = await editar(
      { nombre: 'Conferencia', capacidad: 50 },
      '/api/salones/1/distribuciones/abc',
    );

    expect(sinSalon.status).toBe(404);
    expect(idInvalido.status).toBe(400);
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
      id: 7,
      email: 'ana@empresa.com',
      rol: 'CLIENTE',
    })}`;

    const sinSesion = await request(app)
      .patch('/api/salones/1/distribuciones/1')
      .send({ nombre: 'Conferencia', capacidad: 50 });
    const comoCliente = await editar(
      { nombre: 'Conferencia', capacidad: 50 },
      '/api/salones/1/distribuciones/1',
      cookieCliente,
    );

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(modificarDistribucionMock).not.toHaveBeenCalled();
  });
});

// HU-25 del Sprint 4: baja lógica de una distribución (PO, 06/11/2026). Se da de baja aunque la use
// un evento; los eventos que ya la tienen no cambian (eso lo prueba eventos.rutas.test.ts).
describe('PATCH /api/salones/:id/distribuciones/:distribucionId/estado (HU-25)', () => {
  const app = crearApp();

  const cambiar = (
    cuerpo: object,
    ruta = '/api/salones/1/distribuciones/1/estado',
    cookie = cookiePersonal,
  ) => request(app).patch(ruta).set('Cookie', [cookie]).send(cuerpo);

  beforeEach(() => {
    obtenerSalonPorIdMock.mockReset();
    buscarDistribucionPorIdMock.mockReset();
    cambiarEstadoDistribucionMock.mockReset();
    obtenerSalonPorIdMock.mockResolvedValue(auditorio as never);
    buscarDistribucionPorIdMock.mockResolvedValue(distribucionAuditorio as never);
    cambiarEstadoDistribucionMock.mockImplementation(
      async (id, activo) => ({ ...distribucionAuditorio, id, activo }) as never,
    );
  });

  it('la da de baja y responde 200 con la distribución inactiva', async () => {
    const respuesta = await cambiar({ activo: false });

    expect(respuesta.status).toBe(200);
    expect(cambiarEstadoDistribucionMock).toHaveBeenCalledWith(1, false);
    expect(respuesta.body.data).toMatchObject({ id: 1, salonId: 1, activo: false });
  });

  it('la reactiva', async () => {
    buscarDistribucionPorIdMock.mockResolvedValue({
      ...distribucionAuditorio,
      activo: false,
    } as never);

    const respuesta = await cambiar({ activo: true });

    expect(respuesta.status).toBe(200);
    expect(cambiarEstadoDistribucionMock).toHaveBeenCalledWith(1, true);
  });

  it('reactivar no revisa el nombre: una dada de baja nunca convive con otra del mismo nombre', async () => {
    // El alta y la edición buscan el nombre sin mirar el estado, así que dos distribuciones con
    // el mismo nombre (sin distinguir mayúsculas) no pueden existir, ni una activa ni una de baja.
    buscarDistribucionPorIdMock.mockResolvedValue({
      ...distribucionAuditorio,
      activo: false,
    } as never);
    buscarDistribucionPorNombreMock.mockReset();

    const respuesta = await cambiar({ activo: true });

    expect(respuesta.status).toBe(200);
    expect(buscarDistribucionPorNombreMock).not.toHaveBeenCalled();
  });

  it('darla de baja dos veces o reactivar una activa es idempotente: responde 200', async () => {
    const baja = await cambiar({ activo: false });
    const alta = await cambiar({ activo: true });

    expect(baja.status).toBe(200);
    expect(alta.status).toBe(200);
  });

  it('el body no puede cambiar otro campo de la distribución', async () => {
    await cambiar({ activo: false, nombre: 'Otro', capacidad: 5, salonId: 2 });

    expect(cambiarEstadoDistribucionMock).toHaveBeenCalledWith(1, false);
  });

  it('una distribución de otro salón o inexistente responde 404', async () => {
    buscarDistribucionPorIdMock.mockResolvedValueOnce({
      ...distribucionAuditorio,
      salonId: 2,
    } as never);
    const deOtroSalon = await cambiar({ activo: false });
    buscarDistribucionPorIdMock.mockResolvedValueOnce(null);
    const inexistente = await cambiar({ activo: false });

    expect(deOtroSalon.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(cambiarEstadoDistribucionMock).not.toHaveBeenCalled();
  });

  it('con un salón inexistente responde 404', async () => {
    obtenerSalonPorIdMock.mockResolvedValue(null);

    const respuesta = await cambiar({ activo: false }, '/api/salones/99/distribuciones/1/estado');

    expect(respuesta.status).toBe(404);
    expect(cambiarEstadoDistribucionMock).not.toHaveBeenCalled();
  });

  it('sin activo booleano responde 400 VALIDATION_ERROR', async () => {
    const sinCampo = await cambiar({});
    const comoTexto = await cambiar({ activo: 'no' });

    expect(sinCampo.status).toBe(400);
    expect(sinCampo.body.error.code).toBe('VALIDATION_ERROR');
    expect(comoTexto.status).toBe(400);
    expect(cambiarEstadoDistribucionMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
      id: 7,
      email: 'ana@empresa.com',
      rol: 'CLIENTE',
    })}`;

    const sinSesion = await request(app)
      .patch('/api/salones/1/distribuciones/1/estado')
      .send({ activo: false });
    const comoCliente = await cambiar(
      { activo: false },
      '/api/salones/1/distribuciones/1/estado',
      cookieCliente,
    );

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(cambiarEstadoDistribucionMock).not.toHaveBeenCalled();
  });
});
