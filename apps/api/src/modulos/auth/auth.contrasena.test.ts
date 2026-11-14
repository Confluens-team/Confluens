import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { compararContrasena, hashearContrasena } from '../../lib/contrasena.js';
import {
  firmarToken,
  firmarTokenRestablecimiento,
  NOMBRE_COOKIE_SESION,
  versionDelToken,
} from '../../lib/jwt.js';

// HU-30 y HU-31 del backlog (Sprint 5): un usuario dado de baja no entra ni restablece su
// contraseña, y cada usuario cambia la suya desde Mi cuenta. Se mockea el repositorio (ADR 0003).
vi.mock('./auth.repositorio.js', () => ({
  buscarUsuarioPorEmail: vi.fn(),
  buscarClientePorTelefono: vi.fn(),
  crearUsuarioCliente: vi.fn(),
  buscarClientePorUsuarioId: vi.fn(),
  buscarUsuarioPorId: vi.fn(),
  actualizarContrasena: vi.fn(),
  invalidarSesiones: vi.fn(),
}));
vi.mock('../../lib/correo.js', () => ({ enviarCorreo: vi.fn() }));

const repo = await import('./auth.repositorio.js');
const { enviarCorreo } = await import('../../lib/correo.js');
const buscarUsuarioPorEmailMock = vi.mocked(repo.buscarUsuarioPorEmail);
const buscarUsuarioPorIdMock = vi.mocked(repo.buscarUsuarioPorId);
const actualizarContrasenaMock = vi.mocked(repo.actualizarContrasena);
const enviarCorreoMock = vi.mocked(enviarCorreo);

const app = crearApp();
const CONTRASENA = 'actual123';
const HASH = await hashearContrasena(CONTRASENA);

const usuarioRE = (activo = true) => ({
  id: 7,
  email: 're@confluens.test',
  hashContrasena: HASH,
  rol: 'RESPONSABLE_EVENTOS' as const,
  versionSesion: 2,
  activo,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
});

const cookieRE = `${NOMBRE_COOKIE_SESION}=${firmarToken(
  { id: 7, email: 're@confluens.test', rol: 'RESPONSABLE_EVENTOS' },
  2,
)}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usuario dado de baja (HU-31 del backlog)', () => {
  it('no inicia sesión: el mismo 401 genérico que una contraseña incorrecta', async () => {
    buscarUsuarioPorEmailMock.mockResolvedValue(usuarioRE(false));

    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ email: 're@confluens.test', contrasena: CONTRASENA });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    expect(respuesta.headers['set-cookie']).toBeUndefined();
  });

  it('no recibe el enlace para restablecer la contraseña', async () => {
    buscarUsuarioPorEmailMock.mockResolvedValue(usuarioRE(false));

    const respuesta = await request(app)
      .post('/api/auth/contrasena/olvido')
      .send({ email: 're@confluens.test' });

    expect(respuesta.status).toBe(204);
    await vi.waitFor(() => expect(buscarUsuarioPorEmailMock).toHaveBeenCalled());
    expect(enviarCorreoMock).not.toHaveBeenCalled();
  });

  it('un enlace emitido antes de la baja ya no sirve', async () => {
    buscarUsuarioPorIdMock.mockResolvedValue(usuarioRE(false));
    const token = firmarTokenRestablecimiento(7, HASH);

    const respuesta = await request(app)
      .post('/api/auth/contrasena/restablecer')
      .send({ token, contrasena: 'nueva123' });

    expect(respuesta.status).toBe(422);
    expect(actualizarContrasenaMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/contrasena — cambiar la propia contraseña (HU-30 del backlog)', () => {
  const cambiar = (cuerpo: object, cookie: string | null = cookieRE) => {
    const pedido = request(app).post('/api/auth/contrasena');
    return (cookie ? pedido.set('Cookie', [cookie]) : pedido).send(cuerpo);
  };

  it('con la actual correcta guarda la nueva y renueva la cookie con la versión nueva', async () => {
    buscarUsuarioPorIdMock.mockResolvedValue(usuarioRE());
    actualizarContrasenaMock.mockResolvedValue(3);

    const respuesta = await cambiar({ actual: CONTRASENA, nueva: 'nueva123' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      id: 7,
      email: 're@confluens.test',
      rol: 'RESPONSABLE_EVENTOS',
    });
    const [id, hash] = actualizarContrasenaMock.mock.calls[0]!;
    expect(id).toBe(7);
    expect(await compararContrasena('nueva123', hash)).toBe(true);
    // La cookie nueva lleva la versión 3: las sesiones con la 2 (las otras) quedan cerradas.
    const cookies = respuesta.headers['set-cookie'] as unknown as string[];
    const token = cookies.at(-1)!.split(';')[0]!.split('=')[1]!;
    expect(versionDelToken(token)).toBe(3);
  });

  it('con la actual incorrecta responde 422 sin cambiar nada', async () => {
    buscarUsuarioPorIdMock.mockResolvedValue(usuarioRE());

    const respuesta = await cambiar({ actual: 'otra', nueva: 'nueva123' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toBe('La contraseña actual no es correcta');
    expect(actualizarContrasenaMock).not.toHaveBeenCalled();
  });

  it('una nueva de menos de 6 caracteres responde 400', async () => {
    const respuesta = await cambiar({ actual: CONTRASENA, nueva: '12345' });

    expect(respuesta.status).toBe(400);
    expect(actualizarContrasenaMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401', async () => {
    const respuesta = await cambiar({ actual: CONTRASENA, nueva: 'nueva123' }, null);

    expect(respuesta.status).toBe(401);
  });
});
