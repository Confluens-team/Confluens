import type { FirmaSubida, PedidoFirma, RespuestaExito } from '@confluens/shared';
import type { Request, Response } from 'express';

import { firmaDeSubida } from '../../lib/cloudinary.js';

// ADR 0009. req.body ya validado por validar({ body: esquemaPedidoFirma }) en fotos.rutas.ts.
export function firmar(req: Request, res: Response): void {
  const { destino } = req.body as PedidoFirma;
  const cuerpo: RespuestaExito<FirmaSubida> = { data: firmaDeSubida(destino) };
  res.status(200).json(cuerpo);
}
