import {
  puedeAdministrarA,
  puedeAsignarRol,
  type FiltrosUsuarios,
  type ModificarUsuario,
  type RegistrarUsuario,
  type Rol,
  type Sesion,
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

const NOMBRE_DE_ROL: Record<'GERENTE_GENERAL' | 'ADMINISTRADOR_SISTEMA', string> = {
  GERENTE_GENERAL: 'Gerente General',
  ADMINISTRADOR_SISTEMA: 'Administrador del Sistema',
};

// Un usuario del personal, o 404: los clientes se administran en Clientes, no acá.
async function buscarPersonal(
  id: number,
  repo: UsuariosRepositorio,
  tx?: Prisma.TransactionClient,
) {
  const usuario = await repo.buscarPorId(id, tx);
  if (!usuario || usuario.rol === 'CLIENTE') {
    throw ErrorApi.noEncontrado('No existe el usuario del personal indicado');
  }
  return usuario;
}

/**
 * Siempre queda al menos un GG y un ADM activos (dominio.md, «Personal»): si el cambio le saca a
 * `antes` el último lugar de uno de esos roles, se rechaza con 422. Corre dentro de la transacción
 * del cambio, así el conteo es el del momento de escribir.
 */
async function exigirQueQuedenAdministradores(
  antes: { rol: string; activo: boolean },
  despues: { rol: string; activo: boolean },
  repo: UsuariosRepositorio,
  tx: Prisma.TransactionClient,
) {
  for (const rol of ['GERENTE_GENERAL', 'ADMINISTRADOR_SISTEMA'] as const) {
    const loPierde = antes.activo && antes.rol === rol && (!despues.activo || despues.rol !== rol);
    if (loPierde && (await repo.contarActivos(rol, tx)) <= 1) {
      throw ErrorApi.reglaNegocio(`Tiene que quedar al menos un ${NOMBRE_DE_ROL[rol]} activo`);
    }
  }
}

/**
 * HU-30 del backlog: el GG o el ADM modifican el correo y el rol de un usuario del personal.
 * - El GG no toca a un ADM, y el rol nuevo tiene que ser uno que quien modifica pueda asignar (403).
 * - Nadie se cambia su propio rol desde Personal (PO, 07/11/2026): lo hace otro GG o ADM (403).
 * - Siempre queda al menos un GG y un ADM activos (422).
 * - El correo es único entre todos los usuarios (409).
 */
export async function modificarUsuario(
  id: number,
  datos: ModificarUsuario,
  sesion: Sesion,
  repo: UsuariosRepositorio = usuariosRepositorioReal,
) {
  const objetivo = await buscarPersonal(id, repo);
  if (!puedeAdministrarA(sesion.rol, objetivo.rol)) {
    throw ErrorApi.noAutorizado('No podés modificar a un Administrador del Sistema');
  }
  if (datos.rol !== objetivo.rol) {
    if (objetivo.id === sesion.id) throw ErrorApi.noAutorizado('No podés cambiar tu propio rol');
    if (!puedeAsignarRol(sesion.rol, datos.rol)) {
      throw ErrorApi.noAutorizado('No podés asignar ese rol');
    }
  }
  if (datos.email !== objetivo.email) {
    const conEseCorreo = await repo.buscarPorEmail(datos.email);
    if (conEseCorreo && conEseCorreo.id !== id) throw ErrorApi.conflicto(MENSAJE_EMAIL_REGISTRADO);
  }

  try {
    return await repo.enTransaccion(async (tx) => {
      await exigirQueQuedenAdministradores(objetivo, { ...objetivo, rol: datos.rol }, repo, tx);
      return repo.modificar(id, datos, tx);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw ErrorApi.conflicto(MENSAJE_EMAIL_REGISTRADO);
    }
    throw error;
  }
}

/**
 * HU-31 del backlog: baja lógica (`activo: false`) o reactivación. Dado de baja no inicia sesión y
 * sus sesiones se cierran; se sigue viendo en lo que registró. Nadie se da de baja a sí mismo (PO,
 * 07/11/2026), el GG no da de baja a un ADM y siempre queda al menos un GG y un ADM activos.
 */
export async function cambiarEstadoUsuario(
  id: number,
  activo: boolean,
  sesion: Sesion,
  repo: UsuariosRepositorio = usuariosRepositorioReal,
) {
  const objetivo = await buscarPersonal(id, repo);
  if (objetivo.id === sesion.id) {
    throw ErrorApi.noAutorizado('No podés darte de baja ni reactivarte a vos mismo');
  }
  if (!puedeAdministrarA(sesion.rol, objetivo.rol)) {
    throw ErrorApi.noAutorizado('No podés dar de baja a un Administrador del Sistema');
  }
  return repo.enTransaccion(async (tx) => {
    await exigirQueQuedenAdministradores(objetivo, { ...objetivo, activo }, repo, tx);
    return repo.cambiarEstado(id, activo, tx);
  });
}

/**
 * HU-30 del backlog: el ADM le carga una contraseña nueva a cualquier usuario del personal; nadie
 * más cambia la contraseña de otro (PO, 06/11/2026). La ruta ya exige el rol ADM. Las sesiones
 * abiertas de ese usuario se cierran.
 */
export async function cambiarContrasenaUsuario(
  id: number,
  contrasena: string,
  repo: UsuariosRepositorio = usuariosRepositorioReal,
): Promise<void> {
  await buscarPersonal(id, repo);
  await repo.cambiarContrasena(id, await hashearContrasena(contrasena));
}
