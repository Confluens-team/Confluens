import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { hashearContrasena } from '../../lib/contrasena.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// Se mockea el repositorio (no el servicio): así se ejercita la cadena real
// rutas → controlador → servicio, y solo se reemplaza el punto de contacto con
// Prisma. Evita necesitar Postgres en CI (ci.yml no levanta un servicio de DB
// para el job de test) sin perder cobertura sobre la lógica de auth.
vi.mock('./auth.repositorio.js', () => ({
  buscarUsuarioPorEmail: vi.fn(),
  crearUsuarioCliente: vi.fn(),
  buscarClientePorUsuarioId: vi.fn(),
}));

const { buscarUsuarioPorEmail, crearUsuarioCliente, buscarClientePorUsuarioId } =
  await import('./auth.repositorio.js');
const buscarUsuarioPorEmailMock = vi.mocked(buscarUsuarioPorEmail);
const crearUsuarioClienteMock = vi.mocked(crearUsuarioCliente);
const buscarClientePorUsuarioIdMock = vi.mocked(buscarClientePorUsuarioId);

const app = crearApp();

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    buscarUsuarioPorEmailMock.mockReset();
  });

  it('con credenciales válidas responde 200, setea la cookie httpOnly y no expone el token en el body', async () => {
    const hash = await hashearContrasena('contrasena-correcta');
    buscarUsuarioPorEmailMock.mockResolvedValue({
      id: 1,
      email: 'ge@confluens.test',
      hashContrasena: hash,
      rol: 'GERENTE_GENERAL',
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    });

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ge@confluens.test', contrasena: 'contrasena-correcta' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: { id: 1, email: 'ge@confluens.test', rol: 'GERENTE_GENERAL' },
    });
    expect(respuesta.body.data.token).toBeUndefined();
    const cookies = respuesta.headers['set-cookie'] as unknown as string[];
    expect(
      cookies.some((c) => c.startsWith(`${NOMBRE_COOKIE_SESION}=`) && c.includes('HttpOnly')),
    ).toBe(true);
  });

  it('con contraseña incorrecta responde 401 sin indicar cuál dato falló (criterio 2)', async () => {
    const hash = await hashearContrasena('contrasena-correcta');
    buscarUsuarioPorEmailMock.mockResolvedValue({
      id: 1,
      email: 'ge@confluens.test',
      hashContrasena: hash,
      rol: 'GERENTE_GENERAL',
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    });

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ge@confluens.test', contrasena: 'incorrecta' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    expect(respuesta.body.error.message.toLowerCase()).not.toContain('contraseña');
    expect(respuesta.body.error.message.toLowerCase()).not.toContain('email');
  });

  it('con email inexistente responde el mismo 401 genérico (criterio 2)', async () => {
    buscarUsuarioPorEmailMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@confluens.test', contrasena: 'lo-que-sea' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con body inválido (falta contrasena) responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ge@confluens.test' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/logout', () => {
  it('responde 204 y limpia la cookie de sesión', async () => {
    const respuesta = await request(app).post('/api/auth/logout');

    expect(respuesta.status).toBe(204);
    const cookies = respuesta.headers['set-cookie'] as unknown as string[];
    // clearCookie fija la cookie vacía con fecha de expiración en el pasado.
    expect(cookies.some((c) => c.startsWith(`${NOMBRE_COOKIE_SESION}=;`))).toBe(true);
  });
});

describe('GET /api/auth/yo', () => {
  it('sin cookie responde 401 UNAUTHENTICATED', async () => {
    const respuesta = await request(app).get('/api/auth/yo');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con cookie válida responde 200 con la sesión', async () => {
    const token = firmarToken({ id: 1, email: 'ge@confluens.test', rol: 'GERENTE_GENERAL' });

    const respuesta = await request(app)
      .get('/api/auth/yo')
      .set('Cookie', [`${NOMBRE_COOKIE_SESION}=${token}`]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: { id: 1, email: 'ge@confluens.test', rol: 'GERENTE_GENERAL' },
    });
  });
});

describe('POST /api/auth/registro', () => {
  const datosValidos = {
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@empresa.com',
    telefono: '351 555 1234',
    contrasena: 'secreta123',
  };

  beforeEach(() => {
    buscarUsuarioPorEmailMock.mockReset();
    crearUsuarioClienteMock.mockReset();
  });

  it('crea la cuenta con rol CLIENTE, responde 201 e inicia la sesión con la cookie httpOnly', async () => {
    buscarUsuarioPorEmailMock.mockResolvedValue(null);
    crearUsuarioClienteMock.mockImplementation(async (datos) => ({
      id: 7,
      email: datos.email,
      hashContrasena: datos.hashContrasena,
      rol: 'CLIENTE',
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }));

    const respuesta = await request(app).post('/api/auth/registro').send(datosValidos);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ data: { id: 7, email: 'ana@empresa.com', rol: 'CLIENTE' } });
    const cookies = respuesta.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith(`${NOMBRE_COOKIE_SESION}=`))).toBe(true);
    // La contraseña nunca llega en texto plano al repositorio.
    const [datosGuardados] = crearUsuarioClienteMock.mock.calls[0]!;
    expect(datosGuardados.hashContrasena).not.toBe(datosValidos.contrasena);
    expect(datosGuardados.telefono).toBe('351 555 1234');
    // Nombre y apellido llegan separados a la ficha del Cliente (HU-48).
    expect(datosGuardados).toMatchObject({ nombre: 'Ana', apellido: 'Pérez' });
  });

  it('con un email ya registrado responde 409 y no crea nada', async () => {
    buscarUsuarioPorEmailMock.mockResolvedValue({
      id: 1,
      email: 'ana@empresa.com',
      hashContrasena: 'x',
      rol: 'CLIENTE',
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    });

    const respuesta = await request(app).post('/api/auth/registro').send(datosValidos);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearUsuarioClienteMock).not.toHaveBeenCalled();
  });

  it('sin apellido responde 400 VALIDATION_ERROR y no crea nada', async () => {
    const respuesta = await request(app)
      .post('/api/auth/registro')
      .send({ ...datosValidos, apellido: '  ' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearUsuarioClienteMock).not.toHaveBeenCalled();
  });

  it('sin teléfono responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/auth/registro')
      .send({ ...datosValidos, telefono: '' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/perfil', () => {
  it('con sesión de CLIENTE devuelve sus datos comerciales', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue({
      id: 3,
      nombre: 'Ana',
      apellido: 'Pérez',
      telefono: '351 555 1234',
      correo: 'ana@empresa.com',
      activo: true,
      usuarioId: 7,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    });
    const token = firmarToken({ id: 7, email: 'ana@empresa.com', rol: 'CLIENTE' });

    const respuesta = await request(app)
      .get('/api/auth/perfil')
      .set('Cookie', [`${NOMBRE_COOKIE_SESION}=${token}`]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: {
        nombre: 'Ana',
        apellido: 'Pérez',
        telefono: '351 555 1234',
        correo: 'ana@empresa.com',
      },
    });
  });

  it('con sesión del personal responde 403', async () => {
    const token = firmarToken({ id: 1, email: 're@confluens.test', rol: 'RESPONSABLE_EVENTOS' });

    const respuesta = await request(app)
      .get('/api/auth/perfil')
      .set('Cookie', [`${NOMBRE_COOKIE_SESION}=${token}`]);

    expect(respuesta.status).toBe(403);
  });
});
