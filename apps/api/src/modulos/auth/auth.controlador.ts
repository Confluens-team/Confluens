import type { PerfilCliente, RespuestaExito, Sesion } from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  NOMBRE_COOKIE_SESION,
  opcionesCookieSesion,
  opcionesLimpiarCookieSesion,
} from '../../lib/jwt.js';
import {
  iniciarSesion,
  obtenerPerfilCliente,
  registrarCliente,
  restablecerContrasena,
  solicitarRestablecimiento,
} from './auth.servicio.js';

// El controlador arma la respuesta HTTP; la lógica de negocio vive en el servicio
// (convención de arquitectura.md). req.body ya llegó validado por
// validar({body: esquemaCredenciales}) en auth.rutas.ts.
export async function login(req: Request, res: Response): Promise<void> {
  const { sesion, token } = await iniciarSesion(req.body);
  // El token viaja SOLO en la cookie httpOnly, nunca en el body: si fuera parte
  // de la respuesta JSON, cualquier script en la página (XSS) podría leerlo.
  res.cookie(NOMBRE_COOKIE_SESION, token, opcionesCookieSesion());
  const cuerpo: RespuestaExito<Sesion> = { data: sesion };
  res.json(cuerpo);
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(NOMBRE_COOKIE_SESION, opcionesLimpiarCookieSesion());
  res.status(204).send();
}

// Requiere el middleware `autenticar` montado antes en auth.rutas.ts: para cuando
// llega acá, req.usuario ya está garantizado.
export function yo(req: Request, res: Response): void {
  const cuerpo: RespuestaExito<Sesion> = { data: req.usuario! };
  res.json(cuerpo);
}

// Mismo manejo de cookie que login: el cliente queda con la sesión iniciada al registrarse.
export async function registro(req: Request, res: Response): Promise<void> {
  const { sesion, token } = await registrarCliente(req.body);
  res.cookie(NOMBRE_COOKIE_SESION, token, opcionesCookieSesion());
  const cuerpo: RespuestaExito<Sesion> = { data: sesion };
  res.status(201).json(cuerpo);
}

export async function perfil(req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<PerfilCliente> = {
    data: await obtenerPerfilCliente(req.usuario!.id),
  };
  res.json(cuerpo);
}

// Responde 204 enseguida, haya o no una cuenta con ese email, y busca y envía después: así la
// respuesta tampoco tarda distinto según si el email existe (C8 de HU-48). Un error al enviar el
// correo se registra en el log; el usuario puede volver a pedir el enlace.
export function olvidoContrasena(req: Request, res: Response): void {
  res.status(204).send();
  solicitarRestablecimiento(req.body.email).catch((error: unknown) => {
    console.error('No se pudo enviar el correo para restablecer la contraseña:', error);
  });
}

// Mismo manejo de cookie que login: con la contraseña nueva queda la sesión iniciada.
export async function restablecer(req: Request, res: Response): Promise<void> {
  const { sesion, token } = await restablecerContrasena(req.body);
  res.cookie(NOMBRE_COOKIE_SESION, token, opcionesCookieSesion());
  const cuerpo: RespuestaExito<Sesion> = { data: sesion };
  res.json(cuerpo);
}
