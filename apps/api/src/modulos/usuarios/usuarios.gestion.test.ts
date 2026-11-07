import type { Rol } from '@confluens/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { compararContrasena } from '../../lib/contrasena.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// HU-30 y HU-31 del backlog (Sprint 5): modificar, dar de baja y cambiar la contraseña de un usuario
// del personal (dominio.md, «Personal»; PO, 06/11/2026 y 07/11/2026). Se mockea el repositorio, no la
// base (ADR 0003).
const TX = { soy: 'tx' };
vi.mock('./usuarios.repositorio.js', () => ({
  buscarPorEmail: vi.fn(),
  buscarPorId: vi.fn(),
  crear: vi.fn(),
  listar: vi.fn(),
  contarActivos: vi.fn(),
  modificar: vi.fn(),
  cambiarEstado: vi.fn(),
  cambiarContrasena: vi.fn(),
  enTransaccion: vi.fn((ejecutar: (tx: unknown) => unknown) => ejecutar(TX)),
}));

const repo = await import('./usuarios.repositorio.js');
const buscarPorEmailMock = vi.mocked(repo.buscarPorEmail);
const buscarPorIdMock = vi.mocked(repo.buscarPorId);
const contarActivosMock = vi.mocked(repo.contarActivos);
const modificarMock = vi.mocked(repo.modificar);
const cambiarEstadoMock = vi.mocked(repo.cambiarEstado);
const cambiarContrasenaMock = vi.mocked(repo.cambiarContrasena);

const app = crearApp();
const FECHA = new Date('2026-11-07T12:00:00.000Z');

// La sesión es del usuario 1; el objetivo es el 7.
const cookieDe = (rol: Rol, id = 1) =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id, email: 'sesion@confluens.test', rol })}`;
const usuario = (
  rol: Rol,
  datos: Partial<{ id: number; activo: boolean; email: string }> = {},
) => ({
  id: 7,
  email: 'fran@confluens.test',
  rol,
  activo: true,
  creadoEn: FECHA,
  actualizadoEn: FECHA,
  ...datos,
});

beforeEach(() => {
  vi.clearAllMocks();
  buscarPorEmailMock.mockResolvedValue(null);
  // Por defecto hay varios GG y ADM activos: la regla de «al menos uno» no frena nada.
  contarActivosMock.mockResolvedValue(3);
  modificarMock.mockImplementation(async (id, datos) => ({ ...usuario(datos.rol), id, ...datos }));
  cambiarEstadoMock.mockImplementation(async (id, activo) => ({
    ...usuario('RESPONSABLE_EVENTOS'),
    id,
    activo,
  }));
});

describe('PATCH /api/usuarios/:id (HU-30 del backlog)', () => {
  const modificar = (cuerpo: object, cookie = cookieDe('GERENTE_GENERAL'), id = 7) =>
    request(app).patch(`/api/usuarios/${id}`).set('Cookie', [cookie]).send(cuerpo);

  it('el GG cambia el correo y el rol de un RE', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('RESPONSABLE_EVENTOS'));

    const respuesta = await modificar({
      email: ' Franco@Confluens.test ',
      rol: 'RESPONSABLE_FINANZAS',
    });

    expect(respuesta.status).toBe(200);
    expect(modificarMock).toHaveBeenCalledWith(
      7,
      { email: 'franco@confluens.test', rol: 'RESPONSABLE_FINANZAS' },
      TX,
    );
    expect(respuesta.body.data).toMatchObject({ rol: 'RESPONSABLE_FINANZAS', activo: true });
    expect(respuesta.body.data).not.toHaveProperty('hashContrasena');
  });

  it('el GG no modifica a un ADM: 403', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('ADMINISTRADOR_SISTEMA'));

    const respuesta = await modificar({
      email: 'fran@confluens.test',
      rol: 'ADMINISTRADOR_SISTEMA',
    });

    expect(respuesta.status).toBe(403);
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('el GG no asigna el rol ADM: 403', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('RESPONSABLE_EVENTOS'));

    const respuesta = await modificar({
      email: 'fran@confluens.test',
      rol: 'ADMINISTRADOR_SISTEMA',
    });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.message).toBe('No podés asignar ese rol');
  });

  // PO, 07/11/2026: el ADM le cambia el rol a cualquiera, mientras quede al menos un GG.
  it('el ADM le cambia el rol a un GG si queda otro GG activo', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('GERENTE_GENERAL'));
    contarActivosMock.mockResolvedValue(2);

    const respuesta = await modificar(
      { email: 'fran@confluens.test', rol: 'RESPONSABLE_EVENTOS' },
      cookieDe('ADMINISTRADOR_SISTEMA'),
    );

    expect(respuesta.status).toBe(200);
    expect(contarActivosMock).toHaveBeenCalledWith('GERENTE_GENERAL', TX);
  });

  it('cambiarle el rol al último GG activo responde 422', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('GERENTE_GENERAL'));
    contarActivosMock.mockResolvedValue(1);

    const respuesta = await modificar(
      { email: 'fran@confluens.test', rol: 'RESPONSABLE_EVENTOS' },
      cookieDe('ADMINISTRADOR_SISTEMA'),
    );

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toBe(
      'Tiene que quedar al menos un Gerente General activo',
    );
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('cambiarle el rol al último ADM activo responde 422', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('ADMINISTRADOR_SISTEMA'));
    contarActivosMock.mockResolvedValue(1);

    const respuesta = await modificar(
      { email: 'fran@confluens.test', rol: 'GERENTE_GENERAL' },
      cookieDe('ADMINISTRADOR_SISTEMA'),
    );

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toBe(
      'Tiene que quedar al menos un Administrador del Sistema activo',
    );
  });

  // PO, 07/11/2026: nadie se cambia su propio rol desde Personal.
  it('no se puede cambiar el propio rol, pero sí el propio correo', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('GERENTE_GENERAL', { id: 1 }));

    const rol = await modificar(
      { email: 'fran@confluens.test', rol: 'RESPONSABLE_EVENTOS' },
      cookieDe('GERENTE_GENERAL'),
      1,
    );
    const correo = await modificar(
      { email: 'otro@confluens.test', rol: 'GERENTE_GENERAL' },
      cookieDe('GERENTE_GENERAL'),
      1,
    );

    expect(rol.status).toBe(403);
    expect(rol.body.error.message).toBe('No podés cambiar tu propio rol');
    expect(correo.status).toBe(200);
  });

  it('un correo que ya es de otro usuario responde 409', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('RESPONSABLE_EVENTOS'));
    buscarPorEmailMock.mockResolvedValue({ id: 3 });

    const respuesta = await modificar({ email: 'gg@confluens.test', rol: 'RESPONSABLE_EVENTOS' });

    expect(respuesta.status).toBe(409);
    expect(modificarMock).not.toHaveBeenCalled();
  });

  it('un cliente o un id inexistente responde 404', async () => {
    buscarPorIdMock.mockResolvedValueOnce(usuario('CLIENTE'));
    const cliente = await modificar({ email: 'fran@confluens.test', rol: 'RESPONSABLE_EVENTOS' });
    buscarPorIdMock.mockResolvedValueOnce(null);
    const inexistente = await modificar({
      email: 'fran@confluens.test',
      rol: 'RESPONSABLE_EVENTOS',
    });

    expect(cliente.status).toBe(404);
    expect(inexistente.status).toBe(404);
  });

  it.each(['RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'CLIENTE'] as const)(
    'con sesión de %s responde 403',
    async (rol) => {
      const respuesta = await modificar(
        { email: 'fran@confluens.test', rol: 'RESPONSABLE_EVENTOS' },
        cookieDe(rol),
      );

      expect(respuesta.status).toBe(403);
      expect(buscarPorIdMock).not.toHaveBeenCalled();
    },
  );
});

describe('PATCH /api/usuarios/:id/estado (HU-31 del backlog)', () => {
  const cambiar = (activo: unknown, cookie = cookieDe('GERENTE_GENERAL'), id = 7) =>
    request(app).patch(`/api/usuarios/${id}/estado`).set('Cookie', [cookie]).send({ activo });

  it('el GG da de baja a un RE', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('RESPONSABLE_EVENTOS'));

    const respuesta = await cambiar(false);

    expect(respuesta.status).toBe(200);
    expect(cambiarEstadoMock).toHaveBeenCalledWith(7, false, TX);
    expect(respuesta.body.data.activo).toBe(false);
  });

  it('lo reactiva', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('RESPONSABLE_EVENTOS', { activo: false }));

    const respuesta = await cambiar(true);

    expect(respuesta.status).toBe(200);
    expect(cambiarEstadoMock).toHaveBeenCalledWith(7, true, TX);
  });

  it('el GG no da de baja a un ADM: 403', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('ADMINISTRADOR_SISTEMA'));

    const respuesta = await cambiar(false);

    expect(respuesta.status).toBe(403);
    expect(cambiarEstadoMock).not.toHaveBeenCalled();
  });

  it('nadie se da de baja a sí mismo: 403', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('GERENTE_GENERAL', { id: 1 }));

    const respuesta = await cambiar(false, cookieDe('GERENTE_GENERAL'), 1);

    expect(respuesta.status).toBe(403);
    expect(cambiarEstadoMock).not.toHaveBeenCalled();
  });

  it('dar de baja al último ADM activo responde 422', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('ADMINISTRADOR_SISTEMA'));
    contarActivosMock.mockResolvedValue(1);

    const respuesta = await cambiar(false, cookieDe('ADMINISTRADOR_SISTEMA'));

    expect(respuesta.status).toBe(422);
    expect(cambiarEstadoMock).not.toHaveBeenCalled();
  });

  it('sin activo booleano responde 400', async () => {
    const respuesta = await cambiar('no');

    expect(respuesta.status).toBe(400);
  });
});

describe('PUT /api/usuarios/:id/contrasena (HU-30 del backlog)', () => {
  const cambiar = (contrasena: string, cookie = cookieDe('ADMINISTRADOR_SISTEMA')) =>
    request(app).put('/api/usuarios/7/contrasena').set('Cookie', [cookie]).send({ contrasena });

  it('el ADM le carga una contraseña nueva a otro usuario: guarda el hash', async () => {
    buscarPorIdMock.mockResolvedValue(usuario('GERENTE_GENERAL'));

    const respuesta = await cambiar('nueva123');

    expect(respuesta.status).toBe(204);
    const [id, hash] = cambiarContrasenaMock.mock.calls[0]!;
    expect(id).toBe(7);
    expect(await compararContrasena('nueva123', hash)).toBe(true);
  });

  // PO, 06/11/2026: solo el ADM cambia la contraseña de otro.
  it.each(['GERENTE_GENERAL', 'RESPONSABLE_EVENTOS', 'RESPONSABLE_FINANZAS', 'CLIENTE'] as const)(
    'con sesión de %s responde 403',
    async (rol) => {
      const respuesta = await cambiar('nueva123', cookieDe(rol));

      expect(respuesta.status).toBe(403);
      expect(cambiarContrasenaMock).not.toHaveBeenCalled();
    },
  );

  it('una contraseña de menos de 6 caracteres responde 400', async () => {
    const respuesta = await cambiar('12345');

    expect(respuesta.status).toBe(400);
  });
});
