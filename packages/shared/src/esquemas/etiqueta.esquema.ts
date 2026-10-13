import { z } from 'zod';

import { esquemaId } from './comunes.esquema.js';

// Etiqueta que el personal le pone a un cliente, típicamente la empresa en cuyo nombre reserva un
// empleado con su cuenta personal (dominio.md). Es una lista reutilizable: varios clientes pueden
// compartir la misma. Solo la ve el personal: nunca viaja en las respuestas del canal público.
export const esquemaEtiqueta = z.object({
  id: esquemaId,
  nombre: z.string(),
});
export type Etiqueta = z.infer<typeof esquemaEtiqueta>;

// POST /etiquetas. Se crea al asignarla desde el listado de clientes; el nombre es único sin
// distinguir mayúsculas (lo controla el servicio).
export const esquemaCrearEtiqueta = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Escribí el nombre de la etiqueta')
    .max(40, 'La etiqueta admite hasta 40 caracteres'),
});
export type CrearEtiqueta = z.infer<typeof esquemaCrearEtiqueta>;

// PATCH /clientes/:id/etiqueta. `null` le quita la etiqueta al cliente.
export const esquemaAsignarEtiqueta = z.object({
  etiquetaId: esquemaId.nullable(),
});
export type AsignarEtiqueta = z.infer<typeof esquemaAsignarEtiqueta>;
