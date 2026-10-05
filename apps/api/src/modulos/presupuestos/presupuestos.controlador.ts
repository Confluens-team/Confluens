import type {
  CrearPresupuesto,
  FiltrosPresupuestos,
  PresupuestoDetallado,
  PresupuestoListado,
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

// req.query ya validado por validar({ query: esquemaFiltrosPresupuestos }) en presupuestos.rutas.ts.
export async function listar(req: Request, res: Response): Promise<void> {
  const presupuestos = await listarPresupuestos(req.query as FiltrosPresupuestos);
  const cuerpo: RespuestaExito<PresupuestoListado[]> = { data: presupuestos };
  res.status(200).json(cuerpo);
}
