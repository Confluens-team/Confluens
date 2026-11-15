import type {
  FiltrosAuditoria,
  MetaAuditoria,
  RegistroAuditoria,
  RespuestaExito,
  ResumenAuditoria,
  RevisionAuditoria,
} from '@confluens/shared';
import type { Request, Response } from 'express';

import {
  exportarAuditoria,
  historialDeEvento,
  listarAuditoria,
  listarCamposAuditados,
  marcarRevisado,
  resumirAuditoria,
} from './auditoria.servicio.js';

// req.query y req.params ya validados (con sus valores por defecto) por validar() en
// auditoria.rutas.ts; req.usuario lo pone autenticar().

export async function listar(req: Request, res: Response): Promise<void> {
  const filtros = req.query as unknown as FiltrosAuditoria;
  const { registros, total, conteos } = await listarAuditoria(filtros);
  const meta: MetaAuditoria = { page: filtros.page, pageSize: filtros.pageSize, total, conteos };
  res.json({ data: registros, meta });
}

export async function campos(_req: Request, res: Response): Promise<void> {
  const cuerpo: RespuestaExito<string[]> = { data: await listarCamposAuditados() };
  res.json(cuerpo);
}

export async function resumen(req: Request, res: Response): Promise<void> {
  const { dias } = req.query as unknown as { dias: number };
  const cuerpo: RespuestaExito<ResumenAuditoria> = { data: await resumirAuditoria(dias) };
  res.json(cuerpo);
}

export async function historial(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as { id: number };
  const cuerpo: RespuestaExito<RegistroAuditoria[]> = { data: await historialDeEvento(id) };
  res.json(cuerpo);
}

export async function revisar(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as { id: number };
  const cuerpo: RespuestaExito<RevisionAuditoria> = {
    data: await marcarRevisado(id, req.usuario!.id),
  };
  res.status(201).json(cuerpo);
}

export async function exportar(req: Request, res: Response): Promise<void> {
  const filtros = req.query as unknown as FiltrosAuditoria;
  const csv = await exportarAuditoria(filtros);
  res
    .status(200)
    .type('text/csv; charset=utf-8')
    .attachment('auditoria.csv')
    // BOM: así Excel abre los acentos bien.
    .send(`\uFEFF${csv}`);
}
