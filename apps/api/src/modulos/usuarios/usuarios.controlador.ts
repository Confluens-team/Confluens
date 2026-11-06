import type { FiltrosUsuarios, RegistrarUsuario, RespuestaExito, Usuario } from '@confluens/shared';
import type { Request, Response } from 'express';

import { listarUsuarios, registrarUsuario } from './usuarios.servicio.js';

// req.query ya validado por validar({ query: esquemaFiltrosUsuarios }) en usuarios.rutas.ts.
export async function listar(req: Request, res: Response): Promise<void> {
  const usuarios = await listarUsuarios(req.query as FiltrosUsuarios);
  // Las fechas son Date; res.json las serializa en ISO, que es lo que declara esquemaUsuario.
  const cuerpo: RespuestaExito<Usuario[]> = { data: usuarios as unknown as Usuario[] };
  res.status(200).json(cuerpo);
}

// req.body ya validado por validar({ body: esquemaRegistrarUsuario }) y req.usuario seteado por
// autenticar en usuarios.rutas.ts.
export async function registrar(req: Request, res: Response): Promise<void> {
  const usuario = await registrarUsuario(req.body as RegistrarUsuario, req.usuario!.rol);
  const cuerpo: RespuestaExito<Usuario> = { data: usuario as unknown as Usuario };
  res.status(201).json(cuerpo);
}
