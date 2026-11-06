import {
  puedeAsignarRol,
  type FiltrosUsuarios,
  type RegistrarUsuario,
  type Rol,
} from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { hashearContrasena } from '../../lib/contrasena.js';
import { ErrorApi } from '../../lib/errores.js';
import * as usuariosRepositorioReal from './usuarios.repositorio.js';
import type { UsuariosRepositorio } from './usuarios.repositorio.js';

const MENSAJE_EMAIL_REGISTRADO = 'Ya existe un usuario con ese correo';

/**
 * HU-30 del Sprint 4: el GG o el ADM dan de alta a un usuario del personal con su rol y la
 * contraseña inicial que le cargan. `quien` es el rol de la sesión: el GG no asigna ADM (403,
 * dominio.md, «Personal»). A diferencia del registro del cliente, no se inicia ninguna sesión: quien
 * da el alta sigue con la suya.
 */
export async function registrarUsuario(
  datos: RegistrarUsuario,
  quien: Rol,
  repo: UsuariosRepositorio = usuariosRepositorioReal,
) {
  if (!puedeAsignarRol(quien, datos.rol)) {
    throw ErrorApi.noAutorizado('No podés asignar ese rol');
  }

  if (await repo.buscarPorEmail(datos.email)) {
    throw ErrorApi.conflicto(MENSAJE_EMAIL_REGISTRADO);
  }

  try {
    return await repo.crear({
      email: datos.email,
      hashContrasena: await hashearContrasena(datos.contrasena),
      rol: datos.rol,
    });
  } catch (error) {
    // Dos altas simultáneas con el mismo correo pasan las dos el chequeo de arriba; el índice único
    // de Usuario.email frena a la segunda (P2002) y se responde el mismo 409, no un 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw ErrorApi.conflicto(MENSAJE_EMAIL_REGISTRADO);
    }
    throw error;
  }
}

// HU-31 del Sprint 4: los usuarios del personal, sin los clientes (esos están en Clientes).
export async function listarUsuarios(
  filtros: FiltrosUsuarios,
  repo: UsuariosRepositorio = usuariosRepositorioReal,
) {
  return repo.listar(filtros.rol);
}
