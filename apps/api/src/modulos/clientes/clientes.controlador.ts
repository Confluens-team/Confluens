import type { ClienteConResumen, RespuestaExito } from '@confluens/shared';
import type { Request, Response } from 'express';

import { listarClientes } from './clientes.servicio.js';

export async function listar(_req: Request, res: Response): Promise<void> {
  const clientes = await listarClientes();
  const cuerpo: RespuestaExito<ClienteConResumen[]> = {
    data: clientes as unknown as ClienteConResumen[],
  };
  res.status(200).json(cuerpo);
}
