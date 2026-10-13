import type {
  ConsultaDetallada,
  CrearConsultaSocial,
  CrearPresupuesto,
  FiltrosPresupuestos,
  ModificarPresupuesto,
  PresupuestoDetallado,
  PresupuestoListado,
  RespuestaExito,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  crearPresupuestoDeEvento,
  darDeBajaPresupuesto,
  generarPresupuesto,
  listarPresupuestos,
  modificarPresupuesto,
  obtenerConsulta,
  registrarConsultaSocial,
} from './presupuestos.servicio.js';

// req.body ya validado por validar({ body: esquemaCrearPresupuesto }) en presupuestos.rutas.ts.
export async function crear(req: Request, res: Response): Promise<void> {
  const presupuesto = await generarPresupuesto(req.body as CrearPresupuesto);
  const cuerpo: RespuestaExito<PresupuestoDetallado> = {
    data: presupuesto as unknown as PresupuestoDetallado,
  };
  res.status(201).json(cuerpo);
}

// ADR 0008. req.body ya validado por validar({ body: esquemaCrearConsultaSocial }); la sesión es
// de un cliente (autorizar('CLIENTE')).
export async function crearSocial(req: Request, res: Response): Promise<void> {
  const presupuesto = await registrarConsultaSocial(
    req.usuario!.id,
    req.body as CrearConsultaSocial,
  );
  const cuerpo: RespuestaExito<PresupuestoDetallado> = {
    data: presupuesto as unknown as PresupuestoDetallado,
  };
  res.status(201).json(cuerpo);
}

// El presupuesto vacío de un evento que todavía no tiene ninguno; el personal lo arma después
// desde la consulta. req.params ya validado en presupuestos.rutas.ts.
export async function crearDeEvento(req: Request, res: Response): Promise<void> {
  const presupuesto = await crearPresupuestoDeEvento(Number(req.params.eventoId));
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

// req.params (y req.body en modificar) ya validados en presupuestos.rutas.ts.
export async function obtener(req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<ConsultaDetallada> = {
    data: await obtenerConsulta(Number(req.params.id)),
  };
  res.status(200).json(cuerpo);
}

export async function modificar(req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<ConsultaDetallada> = {
    data: await modificarPresupuesto(Number(req.params.id), req.body as ModificarPresupuesto),
  };
  res.status(200).json(cuerpo);
}

export async function darDeBaja(req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<ConsultaDetallada> = {
    data: await darDeBajaPresupuesto(Number(req.params.id)),
  };
  res.status(200).json(cuerpo);
}
