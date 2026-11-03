import { z } from 'zod';

import { esquemaFechaHora, esquemaId, esquemaImporte } from './comunes.esquema.js';
import { esquemaDistribucion } from './distribucion.esquema.js';

export const esquemaSalon = z.object({
  id: esquemaId,
  nombre: z.string().min(1),
  capacidadMaxima: z.number().int().positive(),
  superficie: z.number().int().positive(), // m²
  precioJornadaCompleta: esquemaImporte,
  precioMediaJornada: esquemaImporte,
  visibleEnLanding: z.boolean(),
  fotoUrl: z.url().nullable(),
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Salon = z.infer<typeof esquemaSalon>;

// Forma que devuelve GET /api/salones (HU-01): el salón con sus distribuciones ya anidadas.
// Son solo 5 salones con 3 distribuciones cada uno (15 filas en total), así que se resuelve en
// un único viaje de red en vez de forzar a la web a pedir cada distribución por separado — evita
// una segunda ruta (GET /api/salones/:id) que esta historia todavía no necesita.
export const esquemaSalonConDistribuciones = esquemaSalon.extend({
  distribuciones: z.array(esquemaDistribucion),
});
export type SalonConDistribuciones = z.infer<typeof esquemaSalonConDistribuciones>;

// Forma que devuelve GET /api/salones/publicos (HU-07). Es un schema propio y no un .omit() del
// anterior para que quede explícito qué se publica: el criterio 5 pide que el canal público
// exponga solo información de referencia del salón. Los precios no están acá a propósito — no
// viajan por la red aunque nadie los muestre en pantalla; la vista con precios sin IVA es para el
// cliente registrado (Sprint 2). visibleEnLanding tampoco viaja: es un filtro del servidor.
export const esquemaSalonPublico = z.object({
  id: esquemaId,
  nombre: z.string().min(1),
  capacidadMaxima: z.number().int().positive(),
  superficie: z.number().int().positive(), // m²
  fotoUrl: z.url().nullable(),
  distribuciones: z.array(esquemaDistribucion),
});
export type SalonPublico = z.infer<typeof esquemaSalonPublico>;

// Body de PATCH /salones/:id/landing (HU-08). Son los dos únicos campos del salón que administra
// el Administrador del Sistema: qué se publica y con qué foto. Los demás datos del salón
// (capacidad, superficie, precios) los edita el Responsable de Eventos en otra historia.
// Ambos son opcionales porque se puede cambiar solo la visibilidad o solo la foto, pero se exige
// al menos uno: un PATCH vacío no tiene efecto y dejaría una fila de auditoría sin cambio real.
// fotoUrl acepta null explícito: así se despega una foto, que no es lo mismo que no mandar nada.
export const esquemaActualizarLandingSalon = z
  .object({
    visibleEnLanding: z.boolean().optional(),
    fotoUrl: z.url('Ingresá una URL válida').nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, 'No hay nada para actualizar');
export type ActualizarLandingSalon = z.infer<typeof esquemaActualizarLandingSalon>;

// Body de PATCH /salones/:id (HU-26 del Sprint 4, «Modificar información de un salón»). Viaja el
// estado completo de los datos que edita el Responsable de Eventos. El nombre no se modifica (los
// cinco salones son fijos) y la landing sigue en HU-08. Precios sin IVA (RN-05).
//
// Si la capacidad nueva queda por debajo de la de alguna distribución, la API la baja a la del
// salón (equipo, 03/11/2026): la capacidad de una distribución nunca supera la del salón.
const importePositivo = (mensaje: string) =>
  esquemaImporte.refine((valor) => Number(valor) > 0, mensaje);

export const esquemaModificarSalon = z.object({
  capacidadMaxima: z
    .number('Escribí la capacidad máxima')
    .int('La capacidad es un número entero')
    .positive('La capacidad tiene que ser mayor que cero'),
  superficie: z
    .number('Escribí la superficie')
    .int('La superficie es un número entero de m²')
    .positive('La superficie tiene que ser mayor que cero'),
  precioJornadaCompleta: importePositivo(
    'El precio de jornada completa tiene que ser mayor que cero',
  ),
  precioMediaJornada: importePositivo('El precio de media jornada tiene que ser mayor que cero'),
});
export type ModificarSalon = z.infer<typeof esquemaModificarSalon>;
