import type { AsignarEtiqueta, ClienteConResumen, RespuestaExito } from '@confluens/shared';
import type { Request, Response } from 'express';

import { asignarEtiquetaACliente, listarClientes } from './clientes.servicio.js';

export async function listar(_req: Request, res: Response): Promise<void> {
  const clientes = await listarClientes();
  const cuerpo: RespuestaExito<ClienteConResumen[]> = {
    data: clientes as unknown as ClienteConResumen[],
  };
  res.status(200).json(cuerpo);
}

// req.params y req.body ya validados por validar() en clientes.rutas.ts.
export async function asignarEtiqueta(req: Request, res: Response): Promise<void> {
  const cliente = await asignarEtiquetaACliente(Number(req.params.id), req.body as AsignarEtiqueta);
  const cuerpo: RespuestaExito<ClienteConResumen> = {
    data: cliente as unknown as ClienteConResumen,
  };
  res.status(200).json(cuerpo);
}
