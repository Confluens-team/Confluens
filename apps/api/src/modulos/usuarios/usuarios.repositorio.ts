import type { RolPersonal } from '@confluens/shared';

import type { Prisma } from '../../generated/prisma/client.js';
import { enTransaccion as enTransaccionAuditada, registrarAuditoria } from '../../lib/auditoria.js';
import { prisma } from '../../lib/prisma.js';

// Capa de acceso a datos del módulo. Separada del servicio para poder mockearla en
// usuarios.rutas.test.ts sin Postgres (ADR 0003), igual que el resto de los módulos.

// Nunca se selecciona hashContrasena: lo que sale de acá va directo a la respuesta.
const SELECCION = {
  id: true,
  email: true,
  rol: true,
  activo: true,
  creadoEn: true,
  actualizadoEn: true,
} as const;

// El listado de Personal además trae la última actividad. No va en SELECCION: esa es la foto que se
// audita, y anotar actividad no es un cambio del usuario.
const SELECCION_DEL_LISTADO = { ...SELECCION, ultimaActividad: true } as const;

// Usuario.email es único entre todos los roles, clientes incluidos: un correo que ya es de un
// cliente tampoco se puede usar para el personal.
export async function buscarPorEmail(email: string) {
  return prisma.usuario.findUnique({ where: { email }, select: { id: true } });
}

export async function buscarPorId(id: number, tx: Prisma.TransactionClient = prisma) {
  return tx.usuario.findUnique({ where: { id }, select: SELECCION });
}

// Un usuario del personal no tiene ficha de Cliente: se crea solo el Usuario.
export async function crear(datos: { email: string; hashContrasena: string; rol: RolPersonal }) {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({ data: datos, select: SELECCION });
    await registrarAuditoria(tx, {
      entidad: 'Usuario',
      entidadId: usuario.id,
      anterior: null,
      nuevo: usuario,
    });
    return usuario;
  });
}

// Actualiza un usuario y audita lo que cambió (HU-25 del backlog). SELECCION no trae el hash.
async function actualizar(
  id: number,
  data: Prisma.UsuarioUpdateInput,
  tx: Prisma.TransactionClient,
) {
  return enTransaccionAuditada(tx, async (t) => {
    const anterior = await t.usuario.findUniqueOrThrow({ where: { id }, select: SELECCION });
    const usuario = await t.usuario.update({ where: { id }, data, select: SELECCION });
    await registrarAuditoria(t, { entidad: 'Usuario', entidadId: id, anterior, nuevo: usuario });
    return usuario;
  });
}

// Ordena por rol en el orden del enum Rol de schema.prisma (RE, RF, GG, ADM), que es el que usa
// Postgres para comparar enums, y después por correo. Incluye a los dados de baja (HU-31).
export async function listar(rol?: RolPersonal) {
  return prisma.usuario.findMany({
    where: { rol: rol ?? { not: 'CLIENTE' } },
    orderBy: [{ rol: 'asc' }, { email: 'asc' }],
    select: SELECCION_DEL_LISTADO,
  });
}

// Cuántos usuarios activos tienen un rol: siempre tiene que quedar al menos un GG y un ADM.
export async function contarActivos(rol: RolPersonal, tx: Prisma.TransactionClient = prisma) {
  return tx.usuario.count({ where: { rol, activo: true } });
}

// HU-30 del backlog: el correo y el rol. El rol nuevo rige en el request siguiente, porque cada
// request lee el rol de la base (lib/sesion-vigente.ts).
export async function modificar(
  id: number,
  datos: { email: string; rol: RolPersonal },
  tx: Prisma.TransactionClient = prisma,
) {
  return actualizar(id, datos, tx);
}

// HU-31 del backlog: la baja sube la versión de sesión, así se cierran todas sus sesiones (M2).
// Reactivar no la toca: el usuario vuelve a iniciar sesión con su contraseña.
export async function cambiarEstado(
  id: number,
  activo: boolean,
  tx: Prisma.TransactionClient = prisma,
) {
  return actualizar(
    id,
    activo ? { activo } : { activo, versionSesion: { increment: 1 }, ultimaActividad: null },
    tx,
  );
}

// HU-30 del backlog: la contraseña que el ADM le carga a un usuario. Sube la versión de sesión: las
// sesiones abiertas con la contraseña anterior se cierran.
export async function cambiarContrasena(id: number, hashContrasena: string) {
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id },
      // Se cierran sus sesiones: ya no está conectado.
      data: { hashContrasena, versionSesion: { increment: 1 }, ultimaActividad: null },
    });
    // La contraseña nunca se guarda en la auditoría: solo que se cambió.
    await registrarAuditoria(tx, {
      entidad: 'Usuario',
      entidadId: id,
      anterior: { contrasena: null },
      nuevo: { contrasena: '(cambiada)' },
    });
  });
}

export async function enTransaccion<T>(
  ejecutar: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => ejecutar(tx));
}

export type UsuariosRepositorio = {
  buscarPorEmail: typeof buscarPorEmail;
  buscarPorId: typeof buscarPorId;
  crear: typeof crear;
  listar: typeof listar;
  contarActivos: typeof contarActivos;
  modificar: typeof modificar;
  cambiarEstado: typeof cambiarEstado;
  cambiarContrasena: typeof cambiarContrasena;
  enTransaccion: typeof enTransaccion;
};
