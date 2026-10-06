import { z } from 'zod';

import { esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';

export const esquemaServicio = z.object({
  id: esquemaId,
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  unidadMedida: z.string().min(1),
  precio: esquemaImporte,
  porPersona: z.boolean(),
  tercerizado: z.boolean(), // suma al total; no recibe el incremento mensual (RN-10)
  activo: z.boolean(),
  categoria: z.string().nullable(), // agrupa el catálogo en la landing (HU-07)
  fotoUrl: z.url().nullable(),
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Servicio = z.infer<typeof esquemaServicio>;

// Body de POST /servicios (HU-32): se omiten los campos que controla el servidor. "activo" nace
// siempre en true (no hay alta con un servicio ya inactivo) y no hay endpoint de baja en este
// sprint, así que tampoco es parte del contrato de creación. "categoria" y "fotoUrl" son contenido
// de la landing: los administra el Administrador del Sistema (HU-08), no el alta del catálogo, y
// nacen en null.
export const esquemaCrearServicio = esquemaServicio.omit({
  id: true,
  activo: true,
  categoria: true,
  fotoUrl: true,
  creadoEn: true,
  actualizadoEn: true,
});
export type CrearServicio = z.infer<typeof esquemaCrearServicio>;

// Forma que devuelve GET /api/servicios/publicos (HU-07). Mismo criterio que esquemaSalonPublico:
// el canal público describe la oferta gastronómica y nada más. Sin precio, sin unidad de medida ni
// porPersona (son datos de presupuestación) y sin tercerizado (es interno).
export const esquemaServicioPublico = z.object({
  id: esquemaId,
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  categoria: z.string().nullable(),
  fotoUrl: z.url().nullable(),
});
export type ServicioPublico = z.infer<typeof esquemaServicioPublico>;

// Body de PATCH /servicios/:id/landing (HU-08). El servicio solo expone la foto: a diferencia del
// salón, no se despublica de a uno — el catálogo público se filtra por "activo", que es el estado
// del servicio en el negocio y no una decisión de la landing.
export const esquemaActualizarLandingServicio = z.object({
  fotoUrl: z.url('Ingresá una URL válida').nullable(),
});
export type ActualizarLandingServicio = z.infer<typeof esquemaActualizarLandingServicio>;
