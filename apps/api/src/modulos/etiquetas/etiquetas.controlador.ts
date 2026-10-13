import type { CrearEtiqueta, Etiqueta, RespuestaExito } from '@confluens/shared';
import type { Request, Response } from 'express';

import { crearEtiqueta, listarEtiquetas } from './etiquetas.servicio.js';

export async function listar(_req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<Etiqueta[]> = { data: await listarEtiquetas() };
  res.status(200).json(cuerpo);
}

// req.body ya validado por validar({ body: esquemaCrearEtiqueta }) en etiquetas.rutas.ts.
export async function crear(req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<Etiqueta> = {
    data: await crearEtiqueta(req.body as CrearEtiqueta),
  };
  res.status(201).json(cuerpo);
}
