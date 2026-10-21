import type {
  AsignarEtiqueta,
  ClienteConResumen,
  FiltrosClientes,
  FiltrosHistorialCliente,
  HistorialCliente,
  ModificarCliente,
  RespuestaExito,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  asignarEtiquetaACliente,
  listarClientes,
  modificarCliente,
  obtenerCliente,
  obtenerHistorialDeCliente,
} from './clientes.servicio.js';

// req.query ya validado por validar({ query: esquemaFiltrosClientes }) en clientes.rutas.ts.
export async function listar(req: Request, res: Response): Promise<void> {
  const clientes = await listarClientes(req.query as FiltrosClientes);
  const cuerpo: RespuestaExito<ClienteConResumen[]> = {
    data: clientes as unknown as ClienteConResumen[],
  };
  res.status(200).json(cuerpo);
}

// req.params ya validado por validar({ params: esquemaIdParam }) en clientes.rutas.ts.
export async function obtener(req: Request, res: Response): Promise<void> {
  const cliente = await obtenerCliente(Number(req.params.id));
  const cuerpo: RespuestaExito<ClienteConResumen> = {
    data: cliente as unknown as ClienteConResumen,
  };
  res.status(200).json(cuerpo);
}

// req.params y req.query ya validados por validar() en clientes.rutas.ts.
export async function historial(req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<HistorialCliente> = {
    data: await obtenerHistorialDeCliente(
      Number(req.params.id),
      req.query as FiltrosHistorialCliente,
    ),
  };
  res.status(200).json(cuerpo);
}

// req.params y req.body ya validados por validar() en clientes.rutas.ts.
export async function asignarEtiqueta(req: Request, res: Response): Promise<void> {
  const cliente = await asignarEtiquetaACliente(Number(req.params.id), req.body as AsignarEtiqueta);
  const cuerpo: RespuestaExito<ClienteConResumen> = {
    data: cliente as unknown as ClienteConResumen,
  };
  res.status(200).json(cuerpo);
}

// req.params y req.body ya validados por validar() en clientes.rutas.ts.
export async function modificar(req: Request, res: Response): Promise<void> {
  const cliente = await modificarCliente(Number(req.params.id), req.body as ModificarCliente);
  const cuerpo: RespuestaExito<ClienteConResumen> = {
    data: cliente as unknown as ClienteConResumen,
  };
  res.status(200).json(cuerpo);
}
