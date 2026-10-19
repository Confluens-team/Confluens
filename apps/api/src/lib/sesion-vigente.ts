import type { Sesion } from '@confluens/shared';

import { prisma } from './prisma.js';

type UsuarioDeSesion = Sesion & { versionSesion: number };

async function buscarUsuario(id: number): Promise<UsuarioDeSesion | null> {
  return prisma.usuario.findUnique({
    where: { id },
    select: { id: true, email: true, rol: true, versionSesion: true },
  });
}

/**
 * M2 de la auditoría de seguridad. El JWT solo prueba que la sesión se emitió alguna vez; sin
 * mirar la base, un usuario borrado o con el rol cambiado seguía operando con el rol viejo
 * mientras renovara la cookie, y ni cerrar sesión ni restablecer la contraseña invalidaban un
 * token ya emitido (por ejemplo, uno robado).
 *
 * Devuelve la sesión tal como está HOY en la base (así un cambio de rol rige en el request
 * siguiente), o null si el usuario ya no existe o su versión de sesión cambió desde que se firmó
 * el token (cerró sesión o restableció la contraseña). Un token sin versión, firmado antes de este
 * control, también es null.
 */
export async function sesionVigente(
  sesion: Sesion,
  version: number | null,
  buscar: (id: number) => Promise<UsuarioDeSesion | null> = buscarUsuario,
): Promise<Sesion | null> {
  if (version === null) return null;
  const usuario = await buscar(sesion.id);
  if (!usuario || usuario.versionSesion !== version) return null;
  return { id: usuario.id, email: usuario.email, rol: usuario.rol };
}
