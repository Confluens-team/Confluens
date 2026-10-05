import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Usuario } from '../../generated/prisma/client.js';
import { compararContrasena, hashearContrasena } from '../../lib/contrasena.js';
import type { Correo } from '../../lib/correo.js';
import { firmarToken, verificarToken } from '../../lib/jwt.js';
import type { AuthRepositorio, RestablecimientoRepositorio } from './auth.repositorio.js';
import {
  iniciarSesion,
  restablecerContrasena,
  solicitarRestablecimiento,
} from './auth.servicio.js';

// Repositorio fake: iniciarSesion() recibe el repositorio real como default
// param, así que acá se lo reemplaza por un objeto en memoria. Ni toca Prisma ni
// necesita una base de datos corriendo (ver decisión técnica del plan de HU-27).
function repositorioFake(usuarios: Usuario[]): AuthRepositorio {
  return {
    buscarUsuarioPorEmail: async (email) => usuarios.find((u) => u.email === email) ?? null,
  };
}

describe('auth.servicio: iniciarSesion', () => {
  it('con credenciales válidas devuelve la sesión y un token verificable', async () => {
    const hash = await hashearContrasena('contrasena-correcta');
    const repositorio = repositorioFake([
      {
        id: 1,
        email: 'ge@confluens.test',
        hashContrasena: hash,
        rol: 'GERENTE_GENERAL',
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      },
    ]);

    const resultado = await iniciarSesion(
      { email: 'ge@confluens.test', contrasena: 'contrasena-correcta' },
      repositorio,
    );

    expect(resultado.sesion).toEqual({ id: 1, email: 'ge@confluens.test', rol: 'GERENTE_GENERAL' });
    // El token que se firma tiene que ser el mismo que después acepta autenticar.ts.
    expect(verificarToken(resultado.token)).toEqual(resultado.sesion);
  });

  it('con contraseña incorrecta lanza el mismo error genérico (criterio 2)', async () => {
    const hash = await hashearContrasena('contrasena-correcta');
    const repositorio = repositorioFake([
      {
        id: 1,
        email: 'ge@confluens.test',
        hashContrasena: hash,
        rol: 'GERENTE_GENERAL',
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      },
    ]);

    await expect(
      iniciarSesion({ email: 'ge@confluens.test', contrasena: 'incorrecta' }, repositorio),
    ).rejects.toMatchObject({ status: 401, codigo: 'UNAUTHENTICATED' });
  });

  it('con email inexistente lanza el mismo error genérico que una contraseña incorrecta (criterio 2)', async () => {
    const repositorio = repositorioFake([]);

    await expect(
      iniciarSesion({ email: 'no-existe@confluens.test', contrasena: 'lo-que-sea' }, repositorio),
    ).rejects.toMatchObject({ status: 401, codigo: 'UNAUTHENTICATED' });
  });
});

// C8 de HU-48: olvidé mi contraseña. El repositorio en memoria guarda el hash que se actualiza,
// para poder probar que el enlace deja de servir después de usarlo.
describe('auth.servicio: restablecer la contraseña', () => {
  afterEach(() => vi.useRealTimers());

  async function preparar() {
    const usuario: Usuario = {
      id: 7,
      email: 'ana@empresa.com',
      hashContrasena: await hashearContrasena('vieja-123'),
      rol: 'CLIENTE',
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    };
    const repositorio: RestablecimientoRepositorio = {
      buscarUsuarioPorEmail: async (email) => (email === usuario.email ? usuario : null),
      buscarUsuarioPorId: async (id) => (id === usuario.id ? usuario : null),
      actualizarContrasena: async (_id, hashContrasena) => {
        usuario.hashContrasena = hashContrasena;
        return usuario;
      },
    };
    const enviados: Correo[] = [];
    const enviar = async (correo: Correo) => {
      enviados.push(correo);
    };
    return { usuario, repositorio, enviados, enviar };
  }

  // El token viaja dentro del enlace del correo.
  const tokenDelCorreo = (correo: Correo) =>
    decodeURIComponent(/token=([^\s"]+)/.exec(correo.texto)![1]!);

  it('con un email registrado manda el enlace a ese email', async () => {
    const { repositorio, enviados, enviar } = await preparar();

    await solicitarRestablecimiento('ana@empresa.com', repositorio, enviar);

    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.para).toBe('ana@empresa.com');
    expect(enviados[0]!.texto).toMatch(/\/restablecer-contrasena\?token=/);
  });

  it('con un email sin cuenta no manda nada', async () => {
    const { repositorio, enviados, enviar } = await preparar();

    await solicitarRestablecimiento('nadie@empresa.com', repositorio, enviar);

    expect(enviados).toHaveLength(0);
  });

  it('con el token del enlace cambia la contraseña, la guarda cifrada e inicia la sesión', async () => {
    const { usuario, repositorio, enviados, enviar } = await preparar();
    await solicitarRestablecimiento('ana@empresa.com', repositorio, enviar);

    const resultado = await restablecerContrasena(
      { token: tokenDelCorreo(enviados[0]!), contrasena: 'nueva-456' },
      repositorio,
    );

    expect(resultado.sesion).toEqual({ id: 7, email: 'ana@empresa.com', rol: 'CLIENTE' });
    expect(verificarToken(resultado.token)).toEqual(resultado.sesion);
    expect(await compararContrasena('nueva-456', usuario.hashContrasena)).toBe(true);
  });

  it('el enlace sirve una sola vez', async () => {
    const { repositorio, enviados, enviar } = await preparar();
    await solicitarRestablecimiento('ana@empresa.com', repositorio, enviar);
    const token = tokenDelCorreo(enviados[0]!);
    await restablecerContrasena({ token, contrasena: 'nueva-456' }, repositorio);

    await expect(
      restablecerContrasena({ token, contrasena: 'otra-789' }, repositorio),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('el enlace vence a los 30 minutos', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z') });
    const { repositorio, enviados, enviar } = await preparar();
    await solicitarRestablecimiento('ana@empresa.com', repositorio, enviar);

    vi.setSystemTime(new Date('2026-10-05T12:31:00Z'));

    await expect(
      restablecerContrasena(
        { token: tokenDelCorreo(enviados[0]!), contrasena: 'nueva-456' },
        repositorio,
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('un token adulterado o un token de sesión no sirven para restablecer', async () => {
    const { repositorio, enviados, enviar } = await preparar();
    await solicitarRestablecimiento('ana@empresa.com', repositorio, enviar);
    const adulterado = `${tokenDelCorreo(enviados[0]!)}x`;
    const deSesion = firmarToken({ id: 7, email: 'ana@empresa.com', rol: 'CLIENTE' });

    for (const token of [adulterado, deSesion, 'cualquier-cosa']) {
      await expect(
        restablecerContrasena({ token, contrasena: 'nueva-456' }, repositorio),
      ).rejects.toMatchObject({ status: 422 });
    }
  });
});
