import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
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
}));

const { listarActivos, listarPublicos, buscarPorNombre, buscarPorId, actualizarLanding, crear } =
  await import('./servicios.repositorio.js');
const listarActivosMock = vi.mocked(listarActivos);
const listarPublicosMock = vi.mocked(listarPublicos);
const buscarPorNombreMock = vi.mocked(buscarPorNombre);
const buscarPorIdMock = vi.mocked(buscarPorId);
const actualizarLandingMock = vi.mocked(actualizarLanding);
const crearMock = vi.mocked(crear);

const app = crearApp();

const servicioDb = {
  id: 1,
  nombre: 'Coffee break estándar',
  descripcion: 'Café, té, agua, jugo y dos tipos de masas dulces/saladas',
  unidadMedida: 'persona',
  precio: new Decimal('4500'),
  porPersona: true,
  tercerizado: false,
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
