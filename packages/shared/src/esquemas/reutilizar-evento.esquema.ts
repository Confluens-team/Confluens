import { z } from 'zod';

import { esquemaFecha, esquemaId } from './comunes.esquema.js';
import { esquemaConsultaDetallada } from './modificar-presupuesto.esquema.js';
import { esquemaHoraEstimada } from './tipo-evento.esquema.js';

// Body de POST /eventos/:id/reutilizar (HU-24): la fecha del evento nuevo, obligatoria y futura (la
// API la controla contra el día de hoy en Córdoba, ADR 0010), y una hora de inicio aproximada,
// como en el cotizador. El horario exacto se carga después, al agendar (ADR 0007).
export const esquemaReutilizarEvento = z.object({
  fecha: esquemaFecha,
  horaInicioEstimada: esquemaHoraEstimada.optional(),
});
export type ReutilizarEvento = z.infer<typeof esquemaReutilizarEvento>;

// Respuesta: la consulta nueva y los avisos para el Responsable de Eventos. `serviciosOmitidos`
// son los del evento original que ya no están en el catálogo y no se copiaron;
// `salonesEnConflicto`, los que ya tienen un evento reservado ese día (RN-12): la consulta se crea
// igual, porque una consulta no bloquea el salón.
export const esquemaEventoReutilizado = z.object({
  consulta: esquemaConsultaDetallada,
  serviciosOmitidos: z.array(z.object({ id: esquemaId, nombre: z.string() })),
  salonesEnConflicto: z.array(z.object({ id: esquemaId, nombre: z.string() })),
});
export type EventoReutilizado = z.infer<typeof esquemaEventoReutilizado>;
