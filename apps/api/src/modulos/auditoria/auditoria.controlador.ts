import type { FiltrosAuditoria, RegistroAuditoria, RespuestaExito } from '@confluens/shared';
import type { Request, Response } from 'express';

import { listarAuditoria, listarCamposAuditados } from './auditoria.servicio.js';

// req.query ya validado (con page y pageSize por defecto) por validar() en auditoria.rutas.ts.
export async function listar(req: Request, res: Response): Promise<void> {
  const filtros = req.query as unknown as FiltrosAuditoria;
  const { registros, total } = await listarAuditoria(filtros);
  const cuerpo: RespuestaExito<RegistroAuditoria[]> = {
    data: registros,
    meta: { page: filtros.page, pageSize: filtros.pageSize, total },
  };
  res.json(cuerpo);
}

export async function campos(_req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<string[]> = { data: await listarCamposAuditados() };
  res.json(cuerpo);
}
