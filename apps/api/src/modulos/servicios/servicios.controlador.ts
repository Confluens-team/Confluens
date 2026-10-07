import type {
  ActualizarLandingServicio,
  CrearServicio,
  RespuestaExito,
  Servicio,
  ServicioPublico,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  actualizarLandingServicio,
  crearServicio,
  listarServicios,
  listarServiciosPublicos,
} from './servicios.servicio.js';

export async function listar(_req: Request, res: Response): Promise<void> {
  const servicios = await listarServicios();
  const cuerpo: RespuestaExito<Servicio[]> = {
    // Prisma serializa Decimal con su propio toJSON(); el shape resultante ya matchea el schema de
    // shared (Decimal -> string), igual que en los demás módulos (ver salones.controlador.ts).
    data: servicios as unknown as Servicio[],
  };
  res.json(cuerpo);
}

// Sin autenticar: es la oferta gastronómica que la landing muestra a cualquiera (HU-07).
export async function listarPublicos(_req: Request, res: Response): Promise<void> {
  const servicios = await listarServiciosPublicos();
  const cuerpo: RespuestaExito<ServicioPublico[]> = { data: servicios };
  res.json(cuerpo);
}

// req.body ya llegó validado por validar({ body: esquemaCrearServicio }) en servicios.rutas.ts.
export async function crear(req: Request, res: Response): Promise<void> {
  const servicio = await crearServicio(req.body as CrearServicio);
  const cuerpo: RespuestaExito<Servicio> = { data: servicio as unknown as Servicio };
  res.status(201).json(cuerpo);
}

// El usuario que audita sale de la sesión, nunca del body (ver salones.controlador.ts).
export async function actualizarLanding(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  const { fotoUrl } = req.body as ActualizarLandingServicio;
  const servicio = await actualizarLandingServicio(id, fotoUrl, req.usuario!.id);
  const cuerpo: RespuestaExito<Servicio> = { data: servicio as unknown as Servicio };
  res.json(cuerpo);
}
