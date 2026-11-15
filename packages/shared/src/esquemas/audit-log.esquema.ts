import { z } from 'zod';

import { TIPOS_DE_ACCION } from '../dominio/auditoria-sensible.js';
import { esquemaFecha, esquemaFechaHora, esquemaId, vacioComoAusente } from './comunes.esquema.js';
import { esquemaRol } from './usuario.esquema.js';

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

export const esquemaTipoDeAccion = z.enum(TIPOS_DE_ACCION);

// Un «true»/«false» de la query string.
const esquemaBooleanoDeQuery = z.enum(['true', 'false']).transform((valor) => valor === 'true');

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
    // Auditoría para Gerencia (15/11/2026): el tipo de acción, solo los sensibles, solo los que
    // esperan la revisión del GG, un registro puntual (con `entidad`) y una búsqueda libre por
    // usuario, número de registro o campo.
    tipo: z.preprocess(vacioComoAusente, esquemaTipoDeAccion.optional()),
    sensibles: z.preprocess(vacioComoAusente, esquemaBooleanoDeQuery.optional()),
    pendientes: z.preprocess(vacioComoAusente, esquemaBooleanoDeQuery.optional()),
    entidadId: z.preprocess(vacioComoAusente, z.string().trim().max(40).optional()),
    buscar: z.preprocess(vacioComoAusente, z.string().trim().max(80).optional()),
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
  usuario: z.object({ id: esquemaId, email: z.string(), rol: esquemaRol }).nullable(),
  entidad: z.string(),
  entidadId: z.string(),
  campos: z.array(z.string()),
  // Solo los campos que cambiaron, campo por campo. null en un alta (valorAnterior).
  valorAnterior: z.record(z.string(), z.unknown()).nullable(),
  valorNuevo: z.record(z.string(), z.unknown()).nullable(),
  // Auditoría para Gerencia: alta, modificación o baja; si toca plata o permisos; si espera la
  // revisión del GG; y la revisión, si ya la tiene.
  tipo: esquemaTipoDeAccion,
  sensible: z.boolean(),
  requiereRevision: z.boolean(),
  revision: z
    .object({ usuario: z.object({ id: esquemaId, email: z.string() }), fecha: esquemaFechaHora })
    .nullable(),
});
export type RegistroAuditoria = z.infer<typeof esquemaRegistroAuditoria>;

// `meta` de GET /auditoria: la página y cuántos cambios hay de cada tipo con los mismos filtros
// (las pestañas Todo / Altas / Modificaciones / Bajas y anulaciones).
export const esquemaMetaAuditoria = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  conteos: z.object({
    todo: z.number(),
    alta: z.number(),
    modificacion: z.number(),
    baja: z.number(),
  }),
});
export type MetaAuditoria = z.infer<typeof esquemaMetaAuditoria>;

// GET /auditoria/resumen: lo que pasó en los últimos `dias` días, para el Gerente General.
export const esquemaFiltrosResumenAuditoria = z.object({
  dias: z.preprocess(vacioComoAusente, z.coerce.number().int().min(1).max(90).default(7)),
});
export const esquemaResumenAuditoria = z.object({
  dias: z.number(),
  cambios: z.number(),
  cambiosPeriodoAnterior: z.number(),
  sensiblesPendientes: z.number(),
  bajas: z.number(),
  bajasDePagos: z.number(),
  personas: z.number(),
  automaticos: z.number(),
  porPersona: z.array(
    z.object({
      usuario: z.object({ id: esquemaId, email: z.string(), rol: esquemaRol }).nullable(),
      cambios: z.number(),
    }),
  ),
  porEntidad: z.array(z.object({ entidad: z.string(), cambios: z.number() })),
  paraRevisar: z.array(esquemaRegistroAuditoria),
});
export type ResumenAuditoria = z.infer<typeof esquemaResumenAuditoria>;

// POST /auditoria/:id/revision: la revisión que dejó el Gerente General.
export const esquemaRevisionAuditoria = z.object({
  auditLogId: esquemaId,
  usuario: z.object({ id: esquemaId, email: z.string() }),
  fecha: esquemaFechaHora,
});
export type RevisionAuditoria = z.infer<typeof esquemaRevisionAuditoria>;
