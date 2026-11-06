import type { RegistrarUsuario, RespuestaExito, Usuario } from '@confluens/shared';
import type { Request, Response } from 'express';

import { registrarUsuario } from './usuarios.servicio.js';

// req.body ya validado por validar({ body: esquemaRegistrarUsuario }) y req.usuario seteado por
// autenticar en usuarios.rutas.ts.
export async function registrar(req: Request, res: Response): Promise<void> {
  const usuario = await registrarUsuario(req.body as RegistrarUsuario, req.usuario!.rol);
  const cuerpo: RespuestaExito<Usuario> = { data: usuario as unknown as Usuario };
  res.status(201).json(cuerpo);
}
