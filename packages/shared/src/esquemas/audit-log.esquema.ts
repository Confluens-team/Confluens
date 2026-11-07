import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId, vacioComoAusente } from './comunes.esquema.js';

// Registro inmutable. usuarioId es null cuando actúa el Sistema (SYS).
export const esquemaAuditLog = z.object({
  id: esquemaId,
  usuarioId: esquemaId.nullable(),
  fecha: esquemaFechaHora,
  entidad: z.string().min(1),
  entidadId: z.string().min(1),
  campos: z.array(z.string()),
  valorAnterior: z.json().nullable(),
  valorNuevo: z.json().nullable(),
});
export type AuditLog = z.infer<typeof esquemaAuditLog>;

// HU-25 del backlog: las partes del sistema que se auditan, con el nombre de la entidad de
// modelo-datos.md. Es el filtro «parte del sistema» de la pestaña Auditoría.
export const ENTIDADES_AUDITADAS = [
  'Salon',
  'Distribucion',
  'Servicio',
  'ConfiguracionPrecios',
  'MedioPago',
  'Cliente',
  'Etiqueta',
  'Solicitud',
  'Evento',
  'Presupuesto',
  'Pago',
  'Usuario',
] as const;
export const esquemaEntidadAuditada = z.enum(ENTIDADES_AUDITADAS);
export type EntidadAuditada = z.infer<typeof esquemaEntidadAuditada>;

// Query de GET /auditoria. Las fechas son de calendario, en la zona de los eventos (ADR 0010).
export const esquemaFiltrosAuditoria = z
  .object({
    entidad: z.preprocess(vacioComoAusente, esquemaEntidadAuditada.optional()),
    campo: z.preprocess(vacioComoAusente, z.string().trim().max(60).optional()),
    usuarioId: z.preprocess(vacioComoAusente, z.coerce.number().int().positive().optional()),
    // Solo los cambios del Sistema (usuario vacío).
    sistema: z.preprocess(
      vacioComoAusente,
      z
        .enum(['true', 'false'])
        .transform((valor) => valor === 'true')
        .optional(),
    ),
    desde: z.preprocess(vacioComoAusente, esquemaFecha.optional()),
    hasta: z.preprocess(vacioComoAusente, esquemaFecha.optional()),
    page: z.preprocess(vacioComoAusente, z.coerce.number().int().positive().default(1)),
    pageSize: z.preprocess(
      vacioComoAusente,
      z.coerce.number().int().positive().max(100).default(20),
    ),
  })
  .refine((filtros) => !filtros.desde || !filtros.hasta || filtros.desde <= filtros.hasta, {
    path: ['hasta'],
    message: 'La fecha hasta no puede ser anterior a la fecha desde',
  });
export type FiltrosAuditoria = z.infer<typeof esquemaFiltrosAuditoria>;

// Un cambio tal como lo muestra la pestaña Auditoría: usuario null es el Sistema.
export const esquemaRegistroAuditoria = z.object({
  id: esquemaId,
  fecha: esquemaFechaHora,
  usuario: z.object({ id: esquemaId, email: z.string() }).nullable(),
  entidad: z.string(),
  entidadId: z.string(),
  campos: z.array(z.string()),
  // Solo los campos que cambiaron, campo por campo. null en un alta (valorAnterior).
  valorAnterior: z.record(z.string(), z.unknown()).nullable(),
  valorNuevo: z.record(z.string(), z.unknown()).nullable(),
});
export type RegistroAuditoria = z.infer<typeof esquemaRegistroAuditoria>;
