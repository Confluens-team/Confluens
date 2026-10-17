import type {
  ActualizarConfiguracionPrecios,
  ConfiguracionPrecios,
  RespuestaExito,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import { guardarConfiguracion, obtenerConfiguracion } from './configuracion-precios.servicio.js';

export async function obtener(_req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<ConfiguracionPrecios> = { data: await obtenerConfiguracion() };
  res.status(200).json(cuerpo);
}

// req.body ya validado por validar({ body: esquemaActualizarConfiguracionPrecios }).
export async function guardar(req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<ConfiguracionPrecios> = {
    data: await guardarConfiguracion(req.body as ActualizarConfiguracionPrecios),
  };
  res.status(200).json(cuerpo);
}
