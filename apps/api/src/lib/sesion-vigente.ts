import type { Sesion } from '@confluens/shared';

import { huellaDe } from './jwt.js';
import { prisma } from './prisma.js';

type UsuarioDeSesion = Sesion & { hashContrasena: string };

async function buscarUsuario(id: number): Promise<UsuarioDeSesion | null> {
  return prisma.usuario.findUnique({
    where: { id },
    select: { id: true, email: true, rol: true, hashContrasena: true },
  });
}

/**
 * M2 de la auditoría de seguridad. El JWT solo prueba que la sesión se emitió alguna vez; sin
 * mirar la base, un usuario borrado o con el rol cambiado seguía operando con el rol viejo
 * mientras renovara la cookie, y restablecer la contraseña no cerraba las sesiones abiertas.
 *
 * Devuelve la sesión tal como está HOY en la base (así un cambio de rol rige en el request
 * siguiente), o null si el usuario ya no existe o su contraseña cambió desde que se firmó el token
 * (la huella no coincide). Un token sin huella, firmado antes de este control, también es null.
 */
export async function sesionVigente(
  sesion: Sesion,
  huella: string | null,
  buscar: (id: number) => Promise<UsuarioDeSesion | null> = buscarUsuario,
): Promise<Sesion | null> {
  if (huella === null) return null;
  const usuario = await buscar(sesion.id);
  if (!usuario || huellaDe(usuario.hashContrasena) !== huella) return null;
  return { id: usuario.id, email: usuario.email, rol: usuario.rol };
}
