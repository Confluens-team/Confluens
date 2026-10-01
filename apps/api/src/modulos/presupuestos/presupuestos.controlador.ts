import type {
  CrearPresupuesto,
  Presupuesto,
  PresupuestoDetallado,
  RespuestaExito,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import { generarPresupuesto, listarPresupuestos } from './presupuestos.servicio.js';

// req.body ya validado por validar({ body: esquemaCrearPresupuesto }) en presupuestos.rutas.ts.
export async function crear(req: Request, res: Response): Promise<void> {
  const presupuesto = await generarPresupuesto(req.body as CrearPresupuesto);
  const cuerpo: RespuestaExito<PresupuestoDetallado> = {
    data: presupuesto as unknown as PresupuestoDetallado,
  };
  res.status(201).json(cuerpo);
}

export async function listar(_req: Request, res: Response): Promise<void> {
  const presupuestos = await listarPresupuestos();
  const cuerpo: RespuestaExito<Presupuesto[]> = {
    data: presupuestos as unknown as Presupuesto[],
  };
  res.json(cuerpo);
}
