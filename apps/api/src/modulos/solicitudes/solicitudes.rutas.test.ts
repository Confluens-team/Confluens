import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio (no el servicio): ejercita la cadena real rutas → controlador →
// servicio, y solo reemplaza el punto de contacto con Prisma. Evita necesitar Postgres en CI,
// mismo criterio que servicios.rutas.test.ts (HU-32) y auth.rutas.test.ts (HU-27).
vi.mock('./solicitudes.repositorio.js', () => ({
  listar: vi.fn(),
  crear: vi.fn(),
}));

const { listar, crear } = await import('./solicitudes.repositorio.js');
const listarMock = vi.mocked(listar);
const crearMock = vi.mocked(crear);

const app = crearApp();

const solicitudDb = {
  id: 1,
  clienteId: null,
  nombre: 'Marina Gómez',
  telefono: '+54 9 351 555-1234',
  correo: 'marina@example.com',
  fechaDeseada: new Date('2026-11-15'),
  cantidadPersonas: 80,
  salonId: null,
  descartada: false,
  eventoId: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

// Sesión del personal: desde HU-48 estos endpoints piden sesión (C5 y C6).
const cookiePersonal = `${NOMBRE_COOKIE_SESION}=${firmarToken({
  id: 1,
  email: 're@confluens.test',
  rol: 'RESPONSABLE_EVENTOS',
})}`;

describe('GET /api/solicitudes', () => {
  beforeEach(() => {
    listarMock.mockReset();
  });

  it('responde 200 con las solicitudes registradas', async () => {
    listarMock.mockResolvedValue([solicitudDb]);

    const respuesta = await request(app).get('/api/solicitudes').set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0]).toMatchObject({ nombre: 'Marina Gómez' });
  });
});

describe('POST /api/solicitudes', () => {
  beforeEach(() => {
    crearMock.mockReset();
  });

  const cuerpoValido = {
    nombre: 'Marina Gómez',
    telefono: '+54 9 351 555-1234',
    correo: 'marina@example.com',
    fechaDeseada: '2026-11-15',
    cantidadPersonas: 80,
  };

  it('con datos completos responde 201 y crea la solicitud (criterio 1)', async () => {
    crearMock.mockResolvedValue(solicitudDb);

    const respuesta = await request(app)
      .post('/api/solicitudes')
      .set('Cookie', [cookiePersonal])
      .send(cuerpoValido);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ nombre: 'Marina Gómez' });
  });

  it('sin datos de contacto responde 400 VALIDATION_ERROR (criterio 5)', async () => {
    const { nombre: _nombre, telefono: _telefono, correo: _correo, ...sinContacto } = cuerpoValido;

    const respuesta = await request(app)
      .post('/api/solicitudes')
      .set('Cookie', [cookiePersonal])
      .send(sinContacto);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('sin fecha deseada responde 400 VALIDATION_ERROR (criterio 5)', async () => {
    const { fechaDeseada: _fechaDeseada, ...sinFecha } = cuerpoValido;

    const respuesta = await request(app)
      .post('/api/solicitudes')
      .set('Cookie', [cookiePersonal])
      .send(sinFecha);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// C6 de HU-48: el listado tiene datos de contacto de todos los clientes, es del panel interno.
describe('solicitudes: permisos (HU-48)', () => {
  const cuerpoValido = {
    nombre: 'Marina Gómez',
    telefono: '+54 9 351 555-1234',
    correo: 'marina@example.com',
    fechaDeseada: '2026-11-15',
    cantidadPersonas: 80,
  };
  const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
    id: 7,
    email: 'ana@empresa.com',
    rol: 'CLIENTE',
  })}`;

  beforeEach(() => {
    listarMock.mockReset();
    crearMock.mockReset();
  });

  it('GET /api/solicitudes sin sesión responde 401', async () => {
    const respuesta = await request(app).get('/api/solicitudes');

    expect(respuesta.status).toBe(401);
    expect(listarMock).not.toHaveBeenCalled();
  });

  it('GET /api/solicitudes con sesión de Cliente responde 403', async () => {
    const respuesta = await request(app).get('/api/solicitudes').set('Cookie', [cookieCliente]);

    expect(respuesta.status).toBe(403);
    expect(listarMock).not.toHaveBeenCalled();
  });

  it('POST /api/solicitudes sin sesión responde 401 y no crea nada', async () => {
    const respuesta = await request(app).post('/api/solicitudes').send(cuerpoValido);

    expect(respuesta.status).toBe(401);
    expect(crearMock).not.toHaveBeenCalled();
  });
});
