import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio (no el servicio): así se ejercita la cadena real
// rutas → controlador → servicio, y solo se reemplaza el punto de contacto con Prisma. Evita
// necesitar Postgres en CI, mismo criterio que auth.rutas.test.ts (HU-27).
vi.mock('./servicios.repositorio.js', () => ({
  listarActivos: vi.fn(),
  listarPublicos: vi.fn(),
  buscarPorNombre: vi.fn(),
  buscarPorId: vi.fn(),
  actualizarLanding: vi.fn(),
  crear: vi.fn(),
  modificar: vi.fn(),
}));

const {
  listarActivos,
  listarPublicos,
  buscarPorNombre,
  buscarPorId,
  actualizarLanding,
  crear,
  modificar,
} = await import('./servicios.repositorio.js');
const listarActivosMock = vi.mocked(listarActivos);
const listarPublicosMock = vi.mocked(listarPublicos);
const buscarPorNombreMock = vi.mocked(buscarPorNombre);
const buscarPorIdMock = vi.mocked(buscarPorId);
const actualizarLandingMock = vi.mocked(actualizarLanding);
const crearMock = vi.mocked(crear);
const modificarMock = vi.mocked(modificar);

const app = crearApp();

const servicioDb = {
  id: 1,
  nombre: 'Coffee break estándar',
  descripcion: 'Café, té, agua, jugo y dos tipos de masas dulces/saladas',
  unidadMedida: 'persona',
  precio: new Decimal('4500'),
  porPersona: true,
  tercerizado: false,
  admiteModalidad: false,
  activo: true,
  categoria: 'Coffee breaks',
  fotoUrl: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

// Sesión del personal: desde HU-48 estos endpoints piden sesión (C5 y C6).
const cookiePersonal = `${NOMBRE_COOKIE_SESION}=${firmarToken({
  id: 1,
  email: 're@confluens.test',
  rol: 'RESPONSABLE_EVENTOS',
})}`;

describe('GET /api/servicios', () => {
  beforeEach(() => {
    listarActivosMock.mockReset();
  });

  it('responde 200 con el catálogo de servicios activos', async () => {
    listarActivosMock.mockResolvedValue([servicioDb]);

    const respuesta = await request(app).get('/api/servicios').set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0]).toMatchObject({
      nombre: 'Coffee break estándar',
      precio: '4500',
    });
  });
});

// HU-07. Igual que en salones: el recorte de campos es un select del repositorio, así que el mock
// ya devuelve la forma recortada y lo que se verifica acá es el contrato de la ruta.
describe('GET /api/servicios/publicos', () => {
  const servicioPublico = {
    id: servicioDb.id,
    nombre: servicioDb.nombre,
    descripcion: servicioDb.descripcion,
    categoria: servicioDb.categoria,
    fotoUrl: servicioDb.fotoUrl,
  };

  beforeEach(() => {
    listarPublicosMock.mockReset();
  });

  it('responde 200 sin sesión, con la oferta agrupable por categoría', async () => {
    listarPublicosMock.mockResolvedValue([servicioPublico]);

    const respuesta = await request(app).get('/api/servicios/publicos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([
      expect.objectContaining({ nombre: 'Coffee break estándar', categoria: 'Coffee breaks' }),
    ]);
  });

  it('no expone precio ni datos internos de presupuestación', async () => {
    listarPublicosMock.mockResolvedValue([servicioPublico]);

    const respuesta = await request(app).get('/api/servicios/publicos');

    expect(respuesta.body.data[0]).not.toHaveProperty('precio');
    expect(respuesta.body.data[0]).not.toHaveProperty('porPersona');
    expect(respuesta.body.data[0]).not.toHaveProperty('tercerizado');
    expect(respuesta.text).not.toContain('4500');
  });
});

describe('POST /api/servicios', () => {
  beforeEach(() => {
    buscarPorNombreMock.mockReset();
    crearMock.mockReset();
  });

  const cuerpoValido = {
    nombre: 'Coffee break estándar',
    descripcion: 'Café, té, agua, jugo y dos tipos de masas dulces/saladas',
    unidadMedida: 'persona',
    precio: '4500',
    porPersona: true,
    tercerizado: false,
    admiteModalidad: false,
  };

  it('con un nombre nuevo responde 201 y crea el servicio', async () => {
    buscarPorNombreMock.mockResolvedValue(null);
    crearMock.mockResolvedValue(servicioDb);

    const respuesta = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send(cuerpoValido);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ nombre: 'Coffee break estándar' });
  });

  it('con un nombre ya existente responde 409 CONFLICT (criterio 4)', async () => {
    buscarPorNombreMock.mockResolvedValue(servicioDb);

    const respuesta = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send(cuerpoValido);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearMock).not.toHaveBeenCalled();
  });

  // Topes de largo (PO, 08/11/2026): nombre 100, descripción 500, unidad de medida 30.
  it.each([
    ['nombre', 100],
    ['descripcion', 500],
    ['unidadMedida', 30],
  ])('el %s admite exactamente %i caracteres y no uno más', async (campo, maximo) => {
    buscarPorNombreMock.mockResolvedValue(null);
    crearMock.mockResolvedValue(servicioDb);

    const justo = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send({ ...cuerpoValido, [campo]: 'a'.repeat(maximo) });
    const pasado = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send({ ...cuerpoValido, [campo]: 'a'.repeat(maximo + 1) });

    expect(justo.status).toBe(201);
    expect(pasado.status).toBe(400);
    expect(pasado.body.error.details[0].campo).toBe(campo);
    expect(crearMock).toHaveBeenCalledTimes(1);
  });

  it('un nombre de solo espacios responde 400 en el alta, igual que en la modificación', async () => {
    const respuesta = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send({ ...cuerpoValido, nombre: '     ' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('nombre');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('el alta guarda el nombre recortado y busca el repetido con ese mismo nombre', async () => {
    buscarPorNombreMock.mockResolvedValue(null);
    crearMock.mockResolvedValue(servicioDb);

    await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send({ ...cuerpoValido, nombre: '   Coffee break estándar  ' });

    expect(buscarPorNombreMock).toHaveBeenCalledWith('Coffee break estándar');
    expect(crearMock).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Coffee break estándar' }),
    );
  });

  it('dos altas simultáneas con el mismo nombre: el índice único responde 409, no 500', async () => {
    buscarPorNombreMock.mockResolvedValue(null);
    crearMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const respuesta = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send(cuerpoValido);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
  });

  it('un tercerizado puede darse de alta a cotizar, sin precio (HU-11)', async () => {
    buscarPorNombreMock.mockResolvedValue(null);
    crearMock.mockResolvedValue({ ...servicioDb, precio: null, tercerizado: true });

    const respuesta = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send({ ...cuerpoValido, precio: null, tercerizado: true });

    expect(respuesta.status).toBe(201);
    expect(crearMock).toHaveBeenCalledWith(expect.objectContaining({ precio: null }));
  });

  it('un servicio propio no puede quedar a cotizar: responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send({ ...cuerpoValido, precio: null });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details).toEqual([
      { campo: 'precio', mensaje: 'Solo un servicio tercerizado puede quedar a cotizar' },
    ]);
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('con body inválido (falta precio) responde 400 VALIDATION_ERROR', async () => {
    const { precio: _precio, ...sinPrecio } = cuerpoValido;

    const respuesta = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookiePersonal])
      .send(sinPrecio);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// HU-08. Mismos permisos y misma auditoría que el PATCH de salones (ver salones.rutas.test.ts para
// el detalle de por qué la fila de audit_log se verifica por la llamada al repositorio).
describe('PATCH /api/servicios/:id/landing', () => {
  const cookieAdmin = `${NOMBRE_COOKIE_SESION}=${firmarToken({
    id: 9,
    email: 'admin@confluens.test',
    rol: 'ADMINISTRADOR_SISTEMA',
  })}`;

  beforeEach(() => {
    buscarPorIdMock.mockReset();
    actualizarLandingMock.mockReset();
  });

  it('con sesión de Administrador del Sistema responde 200 y guarda la foto', async () => {
    buscarPorIdMock.mockResolvedValue(servicioDb);
    actualizarLandingMock.mockResolvedValue({
      ...servicioDb,
      fotoUrl: 'https://ejemplo.test/coffee.jpg',
    });

    const respuesta = await request(app)
      .patch('/api/servicios/1/landing')
      .set('Cookie', [cookieAdmin])
      .send({ fotoUrl: 'https://ejemplo.test/coffee.jpg' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ fotoUrl: 'https://ejemplo.test/coffee.jpg' });
    expect(actualizarLandingMock).toHaveBeenCalledWith(
      1,
      'https://ejemplo.test/coffee.jpg',
      null,
      9,
    );
  });

  it('con fotoUrl null quita la foto', async () => {
    buscarPorIdMock.mockResolvedValue({ ...servicioDb, fotoUrl: 'https://ejemplo.test/vieja.jpg' });
    actualizarLandingMock.mockResolvedValue(servicioDb);

    const respuesta = await request(app)
      .patch('/api/servicios/1/landing')
      .set('Cookie', [cookieAdmin])
      .send({ fotoUrl: null });

    expect(respuesta.status).toBe(200);
    expect(actualizarLandingMock).toHaveBeenCalledWith(
      1,
      null,
      'https://ejemplo.test/vieja.jpg',
      9,
    );
  });

  it('sin cookie de sesión responde 401 UNAUTHENTICATED', async () => {
    const respuesta = await request(app).patch('/api/servicios/1/landing').send({ fotoUrl: null });

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
      .patch('/api/servicios/1/landing')
      .set('Cookie', [cookieDeCliente])
      .send({ fotoUrl: null });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(actualizarLandingMock).not.toHaveBeenCalled();
  });

  it('con un id inexistente responde 404 NOT_FOUND', async () => {
    buscarPorIdMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .patch('/api/servicios/99/landing')
      .set('Cookie', [cookieAdmin])
      .send({ fotoUrl: null });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(actualizarLandingMock).not.toHaveBeenCalled();
  });

  it('con una fotoUrl que no es URL responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .patch('/api/servicios/1/landing')
      .set('Cookie', [cookieAdmin])
      .send({ fotoUrl: 'no-es-una-url' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(actualizarLandingMock).not.toHaveBeenCalled();
  });
});

// C5 y C6 de HU-48: el catálogo con precios pide sesión y el alta es del personal.
describe('servicios: permisos (HU-48)', () => {
  const cuerpoValido = {
    nombre: 'Coffee break estándar',
    descripcion: 'Café, té, agua, jugo y dos tipos de masas dulces/saladas',
    unidadMedida: 'persona',
    precio: '4500',
    porPersona: true,
    tercerizado: false,
    admiteModalidad: false,
  };
  const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
    id: 7,
    email: 'ana@empresa.com',
    rol: 'CLIENTE',
  })}`;

  beforeEach(() => {
    listarActivosMock.mockReset();
    crearMock.mockReset();
  });

  it('GET /api/servicios sin sesión responde 401 y no consulta precios', async () => {
    const respuesta = await request(app).get('/api/servicios');

    expect(respuesta.status).toBe(401);
    expect(listarActivosMock).not.toHaveBeenCalled();
  });

  it('GET /api/servicios con sesión de Cliente responde 200 con los precios', async () => {
    listarActivosMock.mockResolvedValue([servicioDb]);

    const respuesta = await request(app).get('/api/servicios').set('Cookie', [cookieCliente]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data[0]).toHaveProperty('precio');
  });

  it('POST /api/servicios con sesión de Cliente responde 403 y no crea nada', async () => {
    const respuesta = await request(app)
      .post('/api/servicios')
      .set('Cookie', [cookieCliente])
      .send(cuerpoValido);

    expect(respuesta.status).toBe(403);
    expect(crearMock).not.toHaveBeenCalled();
  });
});

// HU-32 del Sprint 4 («Modificar servicio»). Las reglas que dependen de la base (404 y nombre de
// otro servicio) están en el servicio; acá se cubre el contrato: validaciones del schema, status y
// permisos.
describe('PATCH /api/servicios/:id (HU-32 del Sprint 4)', () => {
  const cuerpoValido = {
    nombre: '  Coffee break estándar ',
    descripcion: 'Café, té y masas',
    unidadMedida: 'persona',
    precio: '5200.00',
    porPersona: true,
    tercerizado: false,
    admiteModalidad: true,
    categoria: 'Coffee breaks',
  };

  const modificarServicio = (cuerpo: object, cookie = cookiePersonal, id = 1) =>
    request(app).patch(`/api/servicios/${id}`).set('Cookie', [cookie]).send(cuerpo);

  beforeEach(() => {
    buscarPorIdMock.mockReset();
    buscarPorNombreMock.mockReset();
    modificarMock.mockReset();
    buscarPorIdMock.mockResolvedValue(servicioDb);
    buscarPorNombreMock.mockResolvedValue(servicioDb);
    modificarMock.mockImplementation(async (id, datos) => ({
      ...servicioDb,
      id,
      ...datos,
      precio: datos.precio === null ? null : new Decimal(datos.precio),
    }));
  });

  it('modifica el servicio con los textos recortados y responde 200', async () => {
    const respuesta = await modificarServicio(cuerpoValido);

    expect(respuesta.status).toBe(200);
    expect(modificarMock).toHaveBeenCalledWith(1, {
      ...cuerpoValido,
      nombre: 'Coffee break estándar',
    });
    expect(respuesta.body.data).toMatchObject({ precio: '5200', admiteModalidad: true });
  });

  it('una categoría vacía se guarda como null', async () => {
    await modificarServicio({ ...cuerpoValido, categoria: '   ' });

    expect(modificarMock).toHaveBeenCalledWith(1, expect.objectContaining({ categoria: null }));
  });

  it('un tercerizado puede quedar a cotizar', async () => {
    const respuesta = await modificarServicio({ ...cuerpoValido, tercerizado: true, precio: null });

    expect(respuesta.status).toBe(200);
  });

  it('a cotizar sin ser tercerizado responde 400 VALIDATION_ERROR sobre el precio', async () => {
    const respuesta = await modificarServicio({ ...cuerpoValido, precio: null });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('precio');
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('un precio en cero o con formato inválido responde 400 VALIDATION_ERROR', async () => {
    for (const precio of ['0', '0.00', '12,50', '-100']) {
      const respuesta = await modificarServicio({ ...cuerpoValido, precio });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.details[0].campo).toBe('precio');
    }
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('sin nombre, descripción o unidad de medida responde 400 VALIDATION_ERROR', async () => {
    for (const campo of ['nombre', 'descripcion', 'unidadMedida']) {
      const respuesta = await modificarServicio({ ...cuerpoValido, [campo]: '  ' });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.details[0].campo).toBe(campo);
    }
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('con el nombre de otro servicio responde 409 CONFLICT', async () => {
    buscarPorNombreMock.mockResolvedValue({ ...servicioDb, id: 2, nombre: 'Desayuno americano' });

    const respuesta = await modificarServicio({ ...cuerpoValido, nombre: 'Desayuno americano' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(modificarMock).not.toHaveBeenCalled();
  });

  // Borde del precio: el formato admite hasta 10 dígitos y 2 decimales, y tiene que ser mayor que cero.
  it.each(['0.01', '1', '5200.5', '9999999999.99'])('acepta el precio %s', async (precio) => {
    const respuesta = await modificarServicio({ ...cuerpoValido, precio });

    expect(respuesta.status).toBe(200);
  });

  it.each([
    ['con tres decimales', '100.123'],
    ['de más de 10 dígitos', '12345678901'],
    ['en notación científica', '1e3'],
    ['"Infinity"', 'Infinity'],
    ['"NaN"', 'NaN'],
    ['vacío', ''],
    ['solo espacios', '   '],
    ['negativo con decimales', '-0.01'],
    ['numérico en lugar de texto', 5200],
    ['booleano', true],
  ])('un precio %s responde 400 sobre el precio y no escribe', async (_caso, precio) => {
    const respuesta = await modificarServicio({ ...cuerpoValido, precio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('precio');
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('pasar un tercerizado a propio exige un precio: sin él responde 400', async () => {
    const respuesta = await modificarServicio({
      ...cuerpoValido,
      tercerizado: false,
      precio: null,
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('precio');
  });

  it('pasar un propio a tercerizado a cotizar (sin precio) es válido', async () => {
    const respuesta = await modificarServicio({
      ...cuerpoValido,
      tercerizado: true,
      precio: null,
    });

    expect(respuesta.status).toBe(200);
    expect(modificarMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ tercerizado: true, precio: null }),
    );
  });

  it('un tercerizado a cotizar con modalidad habilitada se acepta: ninguna regla liga los dos campos', async () => {
    const respuesta = await modificarServicio({
      ...cuerpoValido,
      tercerizado: true,
      precio: null,
      admiteModalidad: true,
    });

    expect(respuesta.status).toBe(200);
  });

  // Topes de largo (PO, 08/11/2026): nombre 100, descripción 500, unidad de medida 30.
  it.each([
    ['nombre', 100],
    ['descripcion', 500],
    ['unidadMedida', 30],
  ])('el %s admite exactamente %i caracteres y no uno más', async (campo, maximo) => {
    const justo = await modificarServicio({ ...cuerpoValido, [campo]: 'a'.repeat(maximo) });
    const pasado = await modificarServicio({ ...cuerpoValido, [campo]: 'a'.repeat(maximo + 1) });

    expect(justo.status).toBe(200);
    expect(pasado.status).toBe(400);
    expect(pasado.body.error.details[0].campo).toBe(campo);
    expect(modificarMock).toHaveBeenCalledTimes(1);
  });

  it('un nombre enorme se corta con 400 antes de tocar la base', async () => {
    const respuesta = await modificarServicio({ ...cuerpoValido, nombre: 'x'.repeat(50_000) });

    expect(respuesta.status).toBe(400);
    expect(buscarPorIdMock).not.toHaveBeenCalled();
    expect(buscarPorNombreMock).not.toHaveBeenCalled();
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('cambiarle solo las mayúsculas a su propio nombre no choca', async () => {
    buscarPorNombreMock.mockResolvedValue({
      ...servicioDb,
      id: 1,
      nombre: 'Coffee break estándar',
    });

    const respuesta = await modificarServicio({ ...cuerpoValido, nombre: 'COFFEE BREAK ESTÁNDAR' });

    expect(respuesta.status).toBe(200);
    expect(buscarPorNombreMock).toHaveBeenCalledWith('COFFEE BREAK ESTÁNDAR');
  });

  it('busca el nombre ya recortado, para que los espacios no esquiven el 409', async () => {
    buscarPorNombreMock.mockResolvedValue({ ...servicioDb, id: 2, nombre: 'Desayuno americano' });

    const respuesta = await modificarServicio({
      ...cuerpoValido,
      nombre: '   desayuno AMERICANO   ',
    });

    expect(respuesta.status).toBe(409);
    expect(buscarPorNombreMock).toHaveBeenCalledWith('desayuno AMERICANO');
  });

  it('el nombre con HTML responde 400 y no escribe', async () => {
    const respuesta = await modificarServicio({ ...cuerpoValido, nombre: '<b>Desayuno</b>' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('nombre');
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('acepta nombres con tildes, ñ, números y símbolos que no son marcado', async () => {
    const nombre = 'Menú "Ñandú" 2x1 (sin TACC) — 50% off';

    const respuesta = await modificarServicio({ ...cuerpoValido, nombre });

    expect(respuesta.status).toBe(200);
    expect(modificarMock).toHaveBeenCalledWith(1, expect.objectContaining({ nombre }));
  });

  it('la categoría admite hasta 60 caracteres y null; con 61 responde 400', async () => {
    const justa = await modificarServicio({ ...cuerpoValido, categoria: 'a'.repeat(60) });
    const nula = await modificarServicio({ ...cuerpoValido, categoria: null });
    const larga = await modificarServicio({ ...cuerpoValido, categoria: 'a'.repeat(61) });

    expect(justa.status).toBe(200);
    expect(nula.status).toBe(200);
    expect(larga.status).toBe(400);
    expect(larga.body.error.details[0].campo).toBe('categoria');
  });

  it.each([
    ['sin categoría', { categoria: undefined }],
    ['con porPersona como texto', { porPersona: 'true' }],
    ['con tercerizado nulo', { tercerizado: null }],
    ['con admiteModalidad numérico', { admiteModalidad: 1 }],
    ['sin porPersona', { porPersona: undefined }],
    ['con el nombre numérico', { nombre: 123 }],
    ['con la descripción nula', { descripcion: null }],
  ])('%s responde 400 y no escribe: viaja el estado completo', async (_caso, cambio) => {
    const respuesta = await modificarServicio({ ...cuerpoValido, ...cambio });

    expect(respuesta.status).toBe(400);
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('un body vacío responde 400 con un detalle por cada campo obligatorio', async () => {
    const respuesta = await modificarServicio({});

    expect(respuesta.status).toBe(400);
    const campos = respuesta.body.error.details.map((detalle: { campo: string }) => detalle.campo);
    expect(campos).toEqual(
      expect.arrayContaining([
        'nombre',
        'descripcion',
        'unidadMedida',
        'porPersona',
        'tercerizado',
      ]),
    );
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('el body no puede cambiar el estado, la foto de la landing ni el id', async () => {
    await modificarServicio({
      ...cuerpoValido,
      id: 99,
      activo: false,
      fotoUrl: 'https://ejemplo.com/otra.jpg',
    });

    const datos = modificarMock.mock.calls[0]![1];
    expect(Object.keys(datos).sort()).toEqual([
      'admiteModalidad',
      'categoria',
      'descripcion',
      'nombre',
      'porPersona',
      'precio',
      'tercerizado',
      'unidadMedida',
    ]);
    expect(modificarMock.mock.calls[0]![0]).toBe(1);
  });

  it('con un id que no es entero positivo responde 400 sin consultar', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const respuesta = await modificarServicio(cuerpoValido, cookiePersonal, id as never);
      expect(respuesta.status, id).toBe(400);
    }
    expect(buscarPorIdMock).not.toHaveBeenCalled();
  });

  // El chequeo de nombre repetido es previo a escribir: dos renombres simultáneos al mismo nombre lo
  // pasan los dos y el segundo choca con el índice único de la base. Tiene que ser un 409, no un 500.
  it.each([
    ['P2002', { code: 'P2002' }],
    [
      'el SQLSTATE 23505 del driver',
      { code: 'P2010', meta: { driverAdapterError: { cause: { code: '23505' } } } },
    ],
  ])(
    'dos renombres simultáneos al mismo nombre (%s): responde 409, no 500',
    async (_caso, error) => {
      buscarPorNombreMock.mockResolvedValue(null);
      modificarMock.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          clientVersion: 'test',
          ...error,
        }),
      );

      const respuesta = await modificarServicio(cuerpoValido);

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('CONFLICT');
      expect(respuesta.body.error.message).toContain('Coffee break estándar');
    },
  );

  it('un error de la base que no es de unicidad sigue siendo un 500: no se disfraza de 409', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    buscarPorNombreMock.mockResolvedValue(null);
    modificarMock.mockRejectedValue(new Error('conexión perdida'));

    const respuesta = await modificarServicio(cuerpoValido);

    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('con un servicio inexistente responde 404 NOT_FOUND', async () => {
    buscarPorIdMock.mockResolvedValue(null);

    const respuesta = await modificarServicio(cuerpoValido, cookiePersonal, 99);

    expect(respuesta.status).toBe(404);
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
      id: 7,
      email: 'ana@empresa.com',
      rol: 'CLIENTE',
    })}`;

    const sinSesion = await request(app).patch('/api/servicios/1').send(cuerpoValido);
    const comoCliente = await modificarServicio(cuerpoValido, cookieCliente);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(modificarMock).not.toHaveBeenCalled();
  });
});
