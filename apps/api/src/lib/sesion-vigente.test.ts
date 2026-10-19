import type { Sesion } from '@confluens/shared';
import { describe, expect, it, vi } from 'vitest';

import type * as ModuloSesionVigente from './sesion-vigente.js';

// src/test/preparar.ts mockea este módulo para los tests de rutas; acá se prueba el real.
const { sesionVigente } = await vi.importActual<typeof ModuloSesionVigente>('./sesion-vigente.js');

const sesion: Sesion = { id: 7, email: 're@confluens.test', rol: 'RESPONSABLE_EVENTOS' };
const usuario = { ...sesion, versionSesion: 3 };

describe('sesionVigente (M2 de la auditoría)', () => {
  it('con la versión de sesión actual devuelve la sesión de la base', async () => {
    expect(await sesionVigente(sesion, 3, async () => usuario)).toEqual(sesion);
  });

  it('si el rol cambió en la base, rige el rol nuevo y no el del token', async () => {
    const degradado = { ...usuario, rol: 'CLIENTE' as const };

    const resultado = await sesionVigente(sesion, 3, async () => degradado);

    expect(resultado?.rol).toBe('CLIENTE');
  });

  it('si el usuario ya no existe devuelve null', async () => {
    expect(await sesionVigente(sesion, 3, async () => null)).toBeNull();
  });

  it('un token de antes del logout o del cambio de contraseña (versión vieja) devuelve null', async () => {
    expect(await sesionVigente(sesion, 2, async () => usuario)).toBeNull();
  });

  it('un token sin versión (anterior a M2) devuelve null sin consultar la base', async () => {
    const buscar = vi.fn(async () => usuario);

    expect(await sesionVigente(sesion, null, buscar)).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });
});
