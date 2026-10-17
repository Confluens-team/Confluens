import { z } from 'zod';

import { esquemaCantidadPersonas, esquemaFecha, esquemaId } from './comunes.esquema.js';
import { esquemaConsultaDetallada } from './modificar-presupuesto.esquema.js';
import { esquemaHoraEstimada, esquemaTipoJornada } from './tipo-evento.esquema.js';

// Body de POST /eventos/:id/reutilizar (HU-24). Lo propio del cliente nuevo no se copia del evento
// original (equipo, 17/10/2026): se pide, como en el cotizador. La fecha es obligatoria y futura
// (la API la controla contra el día de hoy en Córdoba, ADR 0010); la hora de inicio, aproximada y
// opcional; el horario exacto se carga después, al agendar (ADR 0007).
export const esquemaReutilizarEvento = z.object({
  fecha: esquemaFecha,
  cantidadPersonas: esquemaCantidadPersonas,
  tipoJornada: esquemaTipoJornada,
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
