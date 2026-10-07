import type { CrearSolicitud, RespuestaExito, Solicitud } from '@confluens/shared';
import type { Request, Response } from 'express';

import { listarSolicitudes, registrarSolicitud } from './solicitudes.servicio.js';

// Sin filtro por rol todavía: el middleware de autenticación (HU-27) no está montado en esta
// rama. Cuando se integre, este endpoint pasa a requerir sesión de Responsable de Eventos /
// Gerente General (ver Panel.tsx, sección "Solicitudes").
export async function listar(_req: Request, res: Response): Promise<void> {
  const solicitudes = await listarSolicitudes();
  const cuerpo: RespuestaExito<Solicitud[]> = {
    data: solicitudes as unknown as Solicitud[],
  };
  res.json(cuerpo);
}

// req.body ya llegó validado por validar({ body: esquemaCrearSolicitud }) en solicitudes.rutas.ts.
// Sin autenticación (criterio 2 de HU-14): cualquiera puede enviar una solicitud desde el
// formulario público.
export async function crear(req: Request, res: Response): Promise<void> {
  const solicitud = await registrarSolicitud(req.body as CrearSolicitud);
  const cuerpo: RespuestaExito<Solicitud> = { data: solicitud as unknown as Solicitud };
  res.status(201).json(cuerpo);
}
