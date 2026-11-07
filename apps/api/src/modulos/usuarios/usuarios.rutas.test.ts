import type { Rol } from '@confluens/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { compararContrasena } from '../../lib/contrasena.js';
import { firmarToken, NOMBRE_COOKIE_SESION, verificarToken } from '../../lib/jwt.js';

// Se mockea el repositorio, no la base: el CI no levanta Postgres (ADR 0003).
vi.mock('./usuarios.repositorio.js', () => ({
  buscarPorEmail: vi.fn(),
  crear: vi.fn(),
  listar: vi.fn(),
}));

const { buscarPorEmail, crear, listar } = await import('./usuarios.repositorio.js');
const buscarPorEmailMock = vi.mocked(buscarPorEmail);
const crearMock = vi.mocked(crear);
const listarMock = vi.mocked(listar);

const cookieDe = (rol: Rol) =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email: 'gg@confluens.test', rol })}`;

const FECHA = new Date('2026-11-06T15:00:00.000Z');
const creado = (email: string, rol: Rol) => ({
  id: 7,
  email,
  rol,
  activo: true,
  creadoEn: FECHA,
  actualizadoEn: FECHA,
});

const alta = { email: 'fran@confluens.test', rol: 'RESPONSABLE_EVENTOS', contrasena: 'inicial1' };

describe('POST /api/usuarios (HU-30 del Sprint 4)', () => {
  const app = crearApp();

  beforeEach(() => {
    buscarPorEmailMock.mockReset().mockResolvedValue(null);
    crearMock.mockReset();
    listarMock.mockReset();
  });

  it('el GG registra un RE: 201 con el usuario, sin hash y sin tocar su propia sesión', async () => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send(alta);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      data: {
        id: 7,
        email: 'fran@confluens.test',
        rol: 'RESPONSABLE_EVENTOS',
        activo: true,
        creadoEn: FECHA.toISOString(),
        actualizadoEn: FECHA.toISOString(),
      },
    });
    // autenticar puede renovar la cookie de quien da el alta; nunca se emite una del usuario nuevo.
    const cookies = (respuesta.headers['set-cookie'] ?? []) as unknown as string[];
    for (const cookie of cookies) {
      const token = cookie.split(';')[0]!.split('=')[1]!;
      expect(verificarToken(token)?.email).toBe('gg@confluens.test');
    }
  });

  it('guarda el hash de la contraseña inicial, nunca el texto plano', async () => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send(alta);

    const guardado = crearMock.mock.calls[0]![0];
    expect(guardado.hashContrasena).not.toBe('inicial1');
    expect(await compararContrasena('inicial1', guardado.hashContrasena)).toBe(true);
  });

  it.each(['GERENTE_GENERAL', 'RESPONSABLE_FINANZAS'] as const)(
    'el GG registra un %s',
    async (rol) => {
      crearMock.mockResolvedValue(creado('nuevo@confluens.test', rol));

      const respuesta = await request(app)
        .post('/api/usuarios')
        .set('Cookie', [cookieDe('GERENTE_GENERAL')])
        .send({ ...alta, email: 'nuevo@confluens.test', rol });

      expect(respuesta.status).toBe(201);
      expect(crearMock).toHaveBeenCalledWith(expect.objectContaining({ rol }));
    },
  );

  it('el ADM registra a otro ADM', async () => {
    crearMock.mockResolvedValue(creado('admin2@confluens.test', 'ADMINISTRADOR_SISTEMA'));

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')])
      .send({ ...alta, email: 'admin2@confluens.test', rol: 'ADMINISTRADOR_SISTEMA' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.rol).toBe('ADMINISTRADOR_SISTEMA');
  });

  it('el GG no puede asignar el rol ADM: 403 FORBIDDEN', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, rol: 'ADMINISTRADOR_SISTEMA' });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it.each(['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'CLIENTE'] as const)(
    'con sesión de %s responde 403: no registra usuarios',
    async (rol) => {
      const respuesta = await request(app)
        .post('/api/usuarios')
        .set('Cookie', [cookieDe(rol)])
        .send(alta);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe('FORBIDDEN');
      expect(crearMock).not.toHaveBeenCalled();
    },
  );

  it('sin sesión responde 401', async () => {
    const respuesta = await request(app).post('/api/usuarios').send(alta);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('el rol Cliente no se asigna por acá: 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')])
      .send({ ...alta, rol: 'CLIENTE' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it.each([
    ['un correo inválido', { email: 'fran' }],
    ['sin correo', { email: '' }],
    ['una contraseña de menos de 6 caracteres', { contrasena: '12345' }],
  ])('con %s responde 400 VALIDATION_ERROR', async (_caso, cambio) => {
    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, ...cambio });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('guarda el correo en minúsculas y sin espacios', async () => {
    crearMock.mockResolvedValue(creado('fran@confluens.test', 'RESPONSABLE_EVENTOS'));

    await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, email: '  Fran@Confluens.TEST ' });

    expect(buscarPorEmailMock).toHaveBeenCalledWith('fran@confluens.test');
    expect(crearMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'fran@confluens.test' }),
    );
  });

  it('un correo que ya es de otro usuario (también de un cliente) responde 409 CONFLICT', async () => {
    buscarPorEmailMock.mockResolvedValue({ id: 3 });

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send({ ...alta, email: 'FRAN@confluens.test' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('dos altas simultáneas con el mismo correo: el índice único (P2002) responde 409, no 500', async () => {
    crearMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const respuesta = await request(app)
      .post('/api/usuarios')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')])
      .send(alta);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
  });
});

describe('GET /api/usuarios (HU-31 del Sprint 4)', () => {
  const app = crearApp();

  beforeEach(() => {
    listarMock.mockReset();
  });

  it.each(['GERENTE_GENERAL', 'ADMINISTRADOR_SISTEMA'] as const)(
    'con sesión de %s lista el personal con correo, rol y fecha de alta, sin hash',
    async (rol) => {
      listarMock.mockResolvedValue([
        creado('re@confluens.test', 'RESPONSABLE_EVENTOS'),
        creado('gg@confluens.test', 'GERENTE_GENERAL'),
      ]);

      const respuesta = await request(app)
        .get('/api/usuarios')
        .set('Cookie', [cookieDe(rol)]);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data).toHaveLength(2);
      expect(respuesta.body.data[0]).toEqual({
        id: 7,
        email: 're@confluens.test',
        rol: 'RESPONSABLE_EVENTOS',
        activo: true,
        creadoEn: FECHA.toISOString(),
        actualizadoEn: FECHA.toISOString(),
      });
      expect(listarMock).toHaveBeenCalledWith(undefined);
    },
  );

  it('filtra por rol', async () => {
    listarMock.mockResolvedValue([creado('rf@confluens.test', 'RESPONSABLE_FINANZAS')]);

    const respuesta = await request(app)
      .get('/api/usuarios?rol=RESPONSABLE_FINANZAS')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(200);
    expect(listarMock).toHaveBeenCalledWith('RESPONSABLE_FINANZAS');
  });

  it('filtrar por el rol Cliente responde 400: los clientes se consultan en Clientes', async () => {
    const respuesta = await request(app)
      .get('/api/usuarios?rol=CLIENTE')
      .set('Cookie', [cookieDe('GERENTE_GENERAL')]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(listarMock).not.toHaveBeenCalled();
  });

  it.each(['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'CLIENTE'] as const)(
    'con sesión de %s responde 403',
    async (rol) => {
      const respuesta = await request(app)
        .get('/api/usuarios')
        .set('Cookie', [cookieDe(rol)]);

      expect(respuesta.status).toBe(403);
      expect(listarMock).not.toHaveBeenCalled();
    },
  );

  it('sin sesión responde 401', async () => {
    const respuesta = await request(app).get('/api/usuarios');

    expect(respuesta.status).toBe(401);
  });
});
