import type {
  ActualizarLandingSalon,
  CambiarEstadoDistribucion,
  CrearDistribucion,
  Distribucion,
  ModificarDistribucion,
  ModificarSalon,
  RespuestaExito,
  Salon,
  SalonConDistribuciones,
  SalonPublico,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  actualizarLandingSalon,
  cambiarEstadoDistribucion,
  listarSalones,
  listarSalonesPublicos,
  modificarDatosSalon,
  modificarDistribucion,
  registrarDistribucion,
} from './salones.servicio.js';

export async function listar(_req: Request, res: Response): Promise<void> {
  const salones = await listarSalones();
  const cuerpo: RespuestaExito<SalonConDistribuciones[]> = {
    // Prisma serializa Decimal como objeto; se castea porque el shape real ya matchea el schema de
    // shared (Decimal -> string) al pasar por res.json(), igual que en los demás módulos.
    data: salones as unknown as SalonConDistribuciones[],
  };
  res.json(cuerpo);
}

// Sin autenticar: es el catálogo que la landing muestra a cualquiera (criterio 1 de HU-07).
export async function listarPublicos(_req: Request, res: Response): Promise<void> {
  const salones = await listarSalonesPublicos();
  const cuerpo: RespuestaExito<SalonPublico[]> = {
    data: salones as unknown as SalonPublico[],
  };
  res.json(cuerpo);
}

// El usuario sale de req.usuario, que ya dejó seteado el middleware autenticar: quién hizo el
// cambio se toma de la sesión y nunca del body, para que no se pueda auditar a nombre de otro.
export async function actualizarLanding(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  const salon = await actualizarLandingSalon(
    id,
    req.body as ActualizarLandingSalon,
    req.usuario!.id,
  );
  const cuerpo: RespuestaExito<Salon> = { data: salon as unknown as Salon };
  res.json(cuerpo);
}

// HU-25. params y body ya validados por validar() en salones.rutas.ts.
export async function crearDistribucion(req: Request, res: Response): Promise<void> {
  const salonId = Number(req.params['id']);
  const distribucion = await registrarDistribucion(salonId, req.body as CrearDistribucion);
  const cuerpo: RespuestaExito<Distribucion> = { data: distribucion as unknown as Distribucion };
  res.status(201).json(cuerpo);
}

// HU-26 (Sprint 4). Devuelve el salón con sus distribuciones, como el listado.
export async function modificar(req: Request, res: Response): Promise<void> {
  const id = Number(req.params['id']);
  const salon = await modificarDatosSalon(id, req.body as ModificarSalon);
  const cuerpo: RespuestaExito<SalonConDistribuciones> = {
    data: salon as unknown as SalonConDistribuciones,
  };
  res.json(cuerpo);
}

// HU-26 (Sprint 4). params y body ya validados por validar() en salones.rutas.ts.
export async function editarDistribucion(req: Request, res: Response): Promise<void> {
  const salonId = Number(req.params['id']);
  const distribucionId = Number(req.params['distribucionId']);
  const distribucion = await modificarDistribucion(
    salonId,
    distribucionId,
    req.body as ModificarDistribucion,
  );
  const cuerpo: RespuestaExito<Distribucion> = { data: distribucion as unknown as Distribucion };
  res.json(cuerpo);
}

// HU-25 (Sprint 4): baja lógica o reactivación. params y body ya validados en salones.rutas.ts.
export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  const distribucion = await cambiarEstadoDistribucion(
    Number(req.params['id']),
    Number(req.params['distribucionId']),
    (req.body as CambiarEstadoDistribucion).activo,
  );
  const cuerpo: RespuestaExito<Distribucion> = { data: distribucion as unknown as Distribucion };
  res.json(cuerpo);
}
