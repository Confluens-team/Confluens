import { z } from 'zod';

import { MODALIDADES_SERVICIO } from '../dominio/precios.js';
import { esquemaId, esquemaImporte } from './comunes.esquema.js';
import { esquemaHoraEstimada } from './tipo-evento.esquema.js';

// RN-11: normal, continuo en salón (+20%) o en mesas con mozo (+30%). Una sola por línea (S-09).
export const esquemaModalidadServicio = z.enum(MODALIDADES_SERVICIO);

// precioUnitario queda congelado al emitir. La línea del salón tiene servicioId null. Una línea
// aCotizar (tercerizado sin precio, HU-11) va con precio y subtotal en 0 y no suma al total.
export const esquemaLineaPresupuesto = z.object({
  id: esquemaId,
  presupuestoId: esquemaId,
  servicioId: esquemaId.nullable(),
  // El salón cuyo alquiler cobra la línea. Las de servicio tienen servicioId; los adicionales
  // escritos a mano no tienen ninguno de los dos.
  salonId: esquemaId.nullable(),
  descripcion: z.string().min(1),
  cantidad: z.number().int().positive(),
  precioUnitario: esquemaImporte,
  subtotal: esquemaImporte,
  // RN-11: precioUnitario es precioBase con el recargo de la modalidad. El salón y los adicionales
  // van siempre Normal y sin precioBase.
  modalidad: esquemaModalidadServicio,
  precioBase: esquemaImporte.nullable(),
  aCotizar: z.boolean(),
  // "HH:mm" dentro del horario del evento, o null si no se pidió una hora. La línea del salón
  // nunca la lleva: su horario es el del evento.
  horaEstimada: esquemaHoraEstimada.nullable(),
});
export type LineaPresupuesto = z.infer<typeof esquemaLineaPresupuesto>;
