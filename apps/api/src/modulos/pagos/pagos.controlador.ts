import type {
  CrearMedioPago,
  CrearPago,
  CuentaEvento,
  FiltrosMediosPago,
  MedioPago,
  ModificarMedioPago,
  RespuestaExito,
  ResultadoPago,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  crearMedioPago,
  listarMediosPago,
  modificarMedioPago,
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

// req.query ya validado por validar({ query: esquemaFiltrosMediosPago }) en pagos.rutas.ts.
export async function listarMedios(req: Request, res: Response): Promise<void> {
  const medios = await listarMediosPago(req.query as FiltrosMediosPago);
  const cuerpo: RespuestaExito<MedioPago[]> = { data: medios as unknown as MedioPago[] };
  res.status(200).json(cuerpo);
}

// req.body ya validado por validar({ body: esquemaCrearMedioPago }) en pagos.rutas.ts.
export async function crearMedio(req: Request, res: Response): Promise<void> {
  const medio = await crearMedioPago(req.body as CrearMedioPago);
  const cuerpo: RespuestaExito<MedioPago> = { data: medio as unknown as MedioPago };
  res.status(201).json(cuerpo);
}

// HU-33 del Sprint 4. params y body ya validados por validar() en pagos.rutas.ts.
export async function modificarMedio(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  const medio = await modificarMedioPago(id, req.body as ModificarMedioPago);
  const cuerpo: RespuestaExito<MedioPago> = { data: medio as unknown as MedioPago };
  res.json(cuerpo);
}
