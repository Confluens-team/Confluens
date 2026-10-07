import type {
  ActualizarLandingSalon,
  RespuestaExito,
  Salon,
  SalonConDistribuciones,
  SalonPublico,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  actualizarLandingSalon,
  listarSalones,
  listarSalonesPublicos,
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
