import { z } from 'zod';

import {
  esquemaFecha,
  esquemaFechaHora,
  esquemaId,
  esquemaImporte,
  vacioComoAusente,
} from './comunes.esquema.js';
import {
  esquemaHoraEstimada,
  esquemaTipoEvento,
  esquemaTipoEventoSocial,
  esquemaTipoJornada,
} from './tipo-evento.esquema.js';

// Notas al pie de la comanda de cocina: menús especiales, alergias, a quién buscar en el salón.
// Son internas: salen solo en esa hoja y el cliente nunca las ve. El tope es generoso porque es
// texto libre, pero acotado para que no entre un documento entero en la columna.
export const esquemaObservacionesComanda = z
  .string()
  .trim()
  .max(2000, 'Las observaciones pueden tener hasta 2000 caracteres');

// Body de PATCH /eventos/:id/observaciones-comanda. Vacío borra lo que hubiera.
export const esquemaGuardarObservacionesComanda = z.object({
  observacionesComanda: esquemaObservacionesComanda,
});
export type GuardarObservacionesComanda = z.infer<typeof esquemaGuardarObservacionesComanda>;

// Valores literales de la máquina de estados aprobada (docs/producto/dominio.md).
export const esquemaEstadoEvento = z.enum(['EnConsulta', 'Reservado', 'Cobrado', 'Cancelado']);
export type EstadoEvento = z.infer<typeof esquemaEstadoEvento>;

// Los estados que ocupan el salón, y por eso lo que la agenda muestra cuando no se filtra nada:
// un `EnConsulta` no bloquea el salón y un `Cancelado` ya lo liberó (dominio.md). Es también lo
// que hace que una franja sin estos eventos se lea como disponible (criterio 5 de HU-15).
export const ESTADOS_QUE_OCUPAN_SALON: readonly EstadoEvento[] = ['Reservado', 'Cobrado'];

// inicio y fin pueden ser null en EnConsulta (y en Cancelado si viene de ahí). Los salones del
// evento y la distribución de cada uno no están acá: viven en EventoSalon, porque un evento puede
// ocupar varios a la vez (ADR 0011). Los traen EventoAgenda y EventoDetallado.
export const esquemaEvento = z.object({
  id: esquemaId,
  clienteId: esquemaId,
  fecha: esquemaFecha,
  inicio: esquemaFechaHora.nullable(),
  fin: esquemaFechaHora.nullable(),
  cantidadPersonas: z.number().int().positive(),
  estado: esquemaEstadoEvento,
  tipo: esquemaTipoEvento,
  tipoSocial: esquemaTipoEventoSocial.nullable(),
  tipoSocialDetalle: z.string().nullable(),
  tipoJornada: esquemaTipoJornada.nullable(),
  horaInicioEstimada: esquemaHoraEstimada.nullable(),
  // Columna del Sprint 1 que quedó sin escribirse: la vigencia de los 10 días es del presupuesto,
  // no del evento (RN-06, RN-08).
  senaVenceEn: esquemaFechaHora.nullable(),
  // Instante en que el acumulado de pagos cruzó el 20% de la base de cobro y el salón quedó
  // reservado (HU-13). Lo escribe el módulo de pagos, no una acción manual.
  senaRegistradaEn: esquemaFechaHora.nullable(),
  modalidadSalonRestaurante: z.boolean(), // opción interna, no visible al cliente
  observacionesComanda: esquemaObservacionesComanda.nullable(),
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Evento = z.infer<typeof esquemaEvento>;

// Agenda del panel del Administrador del Sistema: los eventos que ocupan un salón (Reservado y
// Cobrado), con lo mínimo de cliente, salón y distribución para listarlos sin pedir el detalle de
// cada uno. totalPresupuesto es el total sin IVA (RN-05) del presupuesto Confirmado, si lo hay.
export const esquemaEventoAgenda = esquemaEvento.extend({
  cliente: z.object({
    id: esquemaId,
    nombre: z.string(),
    apellido: z.string().nullable(),
    telefono: z.string(),
    correo: z.string(),
  }),
  // Los salones que ocupa, cada uno con la distribución que tiene armada (null sin agendar).
  salones: z.array(
    z.object({
      id: esquemaId,
      nombre: z.string(),
      distribucion: z.object({ id: esquemaId, nombre: z.string() }).nullable(),
    }),
  ),
  totalPresupuesto: esquemaImporte.nullable(),
});
export type EventoAgenda = z.infer<typeof esquemaEventoAgenda>;

// `salonId` y `estado` admiten varios valores separados por coma (?salonId=1,3), que es lo que
// pide el criterio 3 de HU-15 ("filtrar por uno o varios salones"). Llegan como un solo string
// porque la web los arma con URLSearchParams.
const comoLista = (valor: unknown) => {
  if (typeof valor !== 'string') return valor;
  const partes = valor
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
  return partes.length > 0 ? partes : undefined;
};

// Filtros de GET /eventos (HU-15). `desde` y `hasta` acotan la fecha del evento, inclusive, y son
// lo que manda el calendario cuando se cambia de mes o de vista. Sin `estado` se devuelven los
// ESTADOS_QUE_OCUPAN_SALON: los Cancelado no se muestran por defecto (criterio 2).
export const esquemaFiltrosAgenda = z
  .object({
    desde: z.preprocess(vacioComoAusente, esquemaFecha.optional()),
    hasta: z.preprocess(vacioComoAusente, esquemaFecha.optional()),
    salonId: z.preprocess(comoLista, z.array(z.coerce.number().int().positive()).optional()),
    estado: z.preprocess(comoLista, z.array(esquemaEstadoEvento).optional()),
  })
  .refine((filtros) => !filtros.desde || !filtros.hasta || filtros.desde <= filtros.hasta, {
    path: ['hasta'],
    message: 'La fecha hasta no puede ser anterior a la fecha desde',
  });
export type FiltrosAgenda = z.infer<typeof esquemaFiltrosAgenda>;
