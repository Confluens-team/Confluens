import type { FiltrosUsuarios, RegistrarUsuario, RespuestaExito, Usuario } from '@confluens/shared';
import type { Request, Response } from 'express';

import { listarUsuarios, registrarUsuario } from './usuarios.servicio.js';

// Lo que responde la API de un usuario: solo estos campos. El repositorio ya los elige con un
// `select` sin el hash, pero la respuesta no depende de eso: si una consulta futura trajera de más
// (hashContrasena, versionSesion), no llegaría al cliente. Las fechas son Date; res.json las
// serializa en ISO, que es lo que declara esquemaUsuario.
type UsuarioDeBase = Omit<Usuario, 'creadoEn' | 'actualizadoEn'> & {
  creadoEn: Date;
  actualizadoEn: Date;
};

function aUsuarioPublico(usuario: UsuarioDeBase): UsuarioDeBase {
  const { id, email, rol, creadoEn, actualizadoEn } = usuario;
  return { id, email, rol, creadoEn, actualizadoEn };
}

// El tipo de la respuesta es el JSON ya serializado, no el objeto con Date.
const comoRespuesta = (usuario: UsuarioDeBase) => aUsuarioPublico(usuario) as unknown as Usuario;

// req.query ya validado por validar({ query: esquemaFiltrosUsuarios }) en usuarios.rutas.ts.
export async function listar(req: Request, res: Response): Promise<void> {
  const usuarios = await listarUsuarios(req.query as FiltrosUsuarios);
  const cuerpo: RespuestaExito<Usuario[]> = { data: usuarios.map(comoRespuesta) };
  res.status(200).json(cuerpo);
}

// req.body ya validado por validar({ body: esquemaRegistrarUsuario }) y req.usuario seteado por
// autenticar en usuarios.rutas.ts.
export async function registrar(req: Request, res: Response): Promise<void> {
  const usuario = await registrarUsuario(req.body as RegistrarUsuario, req.usuario!.rol);
  const cuerpo: RespuestaExito<Usuario> = { data: comoRespuesta(usuario) };
  res.status(201).json(cuerpo);
}
