import { z } from 'zod';

import { esquemaFechaHora, esquemaId } from './comunes.esquema.js';

// Nombre único por salón; la capacidad nunca supera la del salón (lo valida la API).
export const esquemaDistribucion = z.object({
  id: esquemaId,
  salonId: esquemaId,
  nombre: z.string().min(1),
  capacidad: z.number().int().positive(),
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
