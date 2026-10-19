import type { Sesion } from '@confluens/shared';
import { describe, expect, it, vi } from 'vitest';

import { huellaDe } from './jwt.js';
import type * as ModuloSesionVigente from './sesion-vigente.js';

// src/test/preparar.ts mockea este módulo para los tests de rutas; acá se prueba el real.
const { sesionVigente } = await vi.importActual<typeof ModuloSesionVigente>('./sesion-vigente.js');

const sesion: Sesion = { id: 7, email: 're@confluens.test', rol: 'RESPONSABLE_EVENTOS' };
const usuario = { ...sesion, hashContrasena: '$2b$10$hashActual' };

describe('sesionVigente (M2 de la auditoría)', () => {
  it('con la huella de la contraseña actual devuelve la sesión de la base', async () => {
    const resultado = await sesionVigente(
      sesion,
      huellaDe(usuario.hashContrasena),
      async () => usuario,
    );

    expect(resultado).toEqual(sesion);
  });

  it('si el rol cambió en la base, rige el rol nuevo y no el del token', async () => {
    const degradado = { ...usuario, rol: 'CLIENTE' as const };

    const resultado = await sesionVigente(
      sesion,
      huellaDe(usuario.hashContrasena),
      async () => degradado,
    );

    expect(resultado?.rol).toBe('CLIENTE');
  });

  it('si el usuario ya no existe devuelve null', async () => {
    expect(
      await sesionVigente(sesion, huellaDe(usuario.hashContrasena), async () => null),
    ).toBeNull();
  });

  it('si la contraseña cambió desde que se firmó el token devuelve null', async () => {
    const huellaVieja = huellaDe('$2b$10$hashAnterior');

    expect(await sesionVigente(sesion, huellaVieja, async () => usuario)).toBeNull();
  });

  it('un token sin huella (anterior a M2) devuelve null sin consultar la base', async () => {
    const buscar = vi.fn(async () => usuario);

    expect(await sesionVigente(sesion, null, buscar)).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });
});
