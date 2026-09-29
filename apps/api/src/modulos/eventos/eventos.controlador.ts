import type {
  EstadoEvento,
  EventoAgenda,
  EventoDetallado,
  ReservarEvento,
  RespuestaExito,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  cancelarEvento,
  listarAgenda,
  obtenerDetalle,
  registrarSena,
  reservarEvento,
} from './eventos.servicio.js';

// req.query ya validado por validar({ query: esquemaFiltroEventos }) en eventos.rutas.ts.
export async function listar(req: Request, res: Response): Promise<void> {
  const eventos = await listarAgenda(req.query['estado'] as EstadoEvento | undefined);
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

// req.body ya validado por validar({ body: esquemaReservarEvento }) en eventos.rutas.ts.
export async function reservar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const evento = await reservarEvento(id, req.body as ReservarEvento);
  const cuerpo: RespuestaExito<EventoDetallado> = { data: evento as unknown as EventoDetallado };
  res.status(200).json(cuerpo);
}

export async function marcarSena(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const evento = await registrarSena(id);
  const cuerpo: RespuestaExito<EventoDetallado> = { data: evento as unknown as EventoDetallado };
  res.status(200).json(cuerpo);
}

export async function cancelar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const evento = await cancelarEvento(id);
  const cuerpo: RespuestaExito<EventoDetallado> = { data: evento as unknown as EventoDetallado };
  res.status(200).json(cuerpo);
}
