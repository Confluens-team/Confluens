import type {
  CrearMedioPago,
  CrearPago,
  CuentaEvento,
  MedioPago,
  RespuestaExito,
  ResultadoPago,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  crearMedioPago,
  listarMediosPago,
  obtenerCuenta,
  registrarPago,
} from './pagos.servicio.js';

// req.params y req.body ya validados por `validar()` en las rutas.
export async function registrar(req: Request, res: Response): Promise<void> {
  const eventoId = Number(req.params.id);
  const resultado = await registrarPago(eventoId, req.body as CrearPago);
  const cuerpo: RespuestaExito<ResultadoPago> = { data: resultado as unknown as ResultadoPago };
  res.status(201).json(cuerpo);
}

export async function listarCuenta(req: Request, res: Response): Promise<void> {
  const eventoId = Number(req.params.id);
  const cuenta = await obtenerCuenta(eventoId);
  const cuerpo: RespuestaExito<CuentaEvento> = { data: cuenta as unknown as CuentaEvento };
  res.status(200).json(cuerpo);
}

export async function listarMedios(_req: Request, res: Response): Promise<void> {
  const medios = await listarMediosPago();
  const cuerpo: RespuestaExito<MedioPago[]> = { data: medios as unknown as MedioPago[] };
  res.status(200).json(cuerpo);
}

// req.body ya validado por validar({ body: esquemaCrearMedioPago }) en pagos.rutas.ts.
export async function crearMedio(req: Request, res: Response): Promise<void> {
  const medio = await crearMedioPago(req.body as CrearMedioPago);
  const cuerpo: RespuestaExito<MedioPago> = { data: medio as unknown as MedioPago };
  res.status(201).json(cuerpo);
}
