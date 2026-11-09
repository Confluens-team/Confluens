import { z } from 'zod';

import { esquemaFechaHora, esquemaId } from './comunes.esquema.js';

// Nombre único por salón; la capacidad nunca supera la del salón (lo valida la API).
export const esquemaDistribucion = z.object({
  id: esquemaId,
  salonId: esquemaId,
  nombre: z.string().min(1),
  capacidad: z.number().int().positive(),
  // Baja lógica (HU-25 del Sprint 4): dada de baja no se ofrece al presupuestar ni al agendar, pero
  // los eventos que ya la tienen la conservan.
  activo: z.boolean(),
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Distribucion = z.infer<typeof esquemaDistribucion>;

// Body de POST /salones/:id/distribuciones (HU-25). Lo completa el personal en el panel, así que
// los mensajes van en español. Que el nombre no se repita en el salón (sin distinguir mayúsculas)
// y que la capacidad no supere la del salón lo controla la API: dependen de lo que ya hay en la
// base.
export const esquemaCrearDistribucion = z.object({
  nombre: z
    .string('Escribí el nombre de la distribución')
    .trim()
    .min(1, 'Escribí el nombre de la distribución')
    .max(40, 'El nombre admite hasta 40 caracteres'),
  capacidad: z
    .number('Escribí la capacidad')
    .int('La capacidad es un número entero')
    .positive('La capacidad tiene que ser mayor que cero'),
});
export type CrearDistribucion = z.infer<typeof esquemaCrearDistribucion>;

// Body de PATCH /salones/:id/distribuciones/:distribucionId (HU-26 del Sprint 4): las
// distribuciones se editan aunque el salón no (equipo, 03/11/2026). Viaja el estado completo, con
// las mismas reglas que el alta; la API controla de nuevo el nombre repetido y la capacidad del
// salón.
export const esquemaModificarDistribucion = esquemaCrearDistribucion;
export type ModificarDistribucion = z.infer<typeof esquemaModificarDistribucion>;

// Body de PATCH /salones/:id/distribuciones/:distribucionId/estado (HU-25 del Sprint 4): `false` la
// da de baja y `true` la reactiva. Se da de baja aunque la use un evento (PO, 06/11/2026).
export const esquemaCambiarEstadoDistribucion = z.object({
  activo: z.boolean('Indicá si la distribución queda activa o dada de baja'),
});
export type CambiarEstadoDistribucion = z.infer<typeof esquemaCambiarEstadoDistribucion>;
