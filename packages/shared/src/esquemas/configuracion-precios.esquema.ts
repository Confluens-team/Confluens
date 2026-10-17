import { z } from 'zod';

import { esquemaFechaHora } from './comunes.esquema.js';

// RN-10 / RN-13: el porcentaje de incremento mensual con el que se proyectan a la fecha del evento
// los precios del salón y de los servicios propios. Viaja como string, como los importes
// (Decimal(5,2)). Lo demás de RN-10 (aplicar el aumento al tarifario, aumentos puntuales y su
// historial) es HU-34.
const esquemaPorcentajeMensual = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, 'Ingresá un porcentaje con hasta dos decimales')
  .refine((valor) => Number(valor) <= 100, 'El porcentaje no puede superar el 100%');

export const esquemaConfiguracionPrecios = z.object({
  porcentajeMensual: esquemaPorcentajeMensual,
  actualizadoEn: esquemaFechaHora,
});
export type ConfiguracionPrecios = z.infer<typeof esquemaConfiguracionPrecios>;

// Body de PUT /configuracion-precios.
export const esquemaActualizarConfiguracionPrecios = z.object({
  porcentajeMensual: esquemaPorcentajeMensual,
});
export type ActualizarConfiguracionPrecios = z.infer<typeof esquemaActualizarConfiguracionPrecios>;
