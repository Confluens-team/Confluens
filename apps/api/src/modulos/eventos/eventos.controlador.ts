import type {
  AgendarEvento,
  EventoAgenda,
  EventoDetallado,
  RespuestaExito,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import { agendarEvento, cancelarEvento, listarAgenda, obtenerDetalle } from './eventos.servicio.js';

export async function listar(_req: Request, res: Response): Promise<void> {
  const eventos = await listarAgenda();
  const cuerpo: RespuestaExito<EventoAgenda[]> = { data: eventos as unknown as EventoAgenda[] };
  res.status(200).json(cuerpo);
}

// req.params ya validado por validar({ params: esquemaIdParam }) en eventos.rutas.ts.
export async function obtener(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const evento = await obtenerDetalle(id);
  const cuerpo: RespuestaExito<EventoDetallado> = { data: evento as unknown as EventoDetallado };
  res.status(200).json(cuerpo);
}

// req.body ya validado por validar({ body: esquemaAgendarEvento }) en eventos.rutas.ts.
export async function agendar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const evento = await agendarEvento(id, req.body as AgendarEvento);
  const cuerpo: RespuestaExito<EventoDetallado> = { data: evento as unknown as EventoDetallado };
  res.status(200).json(cuerpo);
}

export async function cancelar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const evento = await cancelarEvento(id);
  const cuerpo: RespuestaExito<EventoDetallado> = { data: evento as unknown as EventoDetallado };
  res.status(200).json(cuerpo);
}
