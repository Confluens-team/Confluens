import { z } from 'zod';

import { esquemaEstadoEvento } from './evento.esquema.js';
import { esquemaFecha, esquemaFechaHora, esquemaId } from './comunes.esquema.js';

// Un choque de salón (RN-12, HU-50): un día del evento pedido en el que un salón ya está ocupado por
// otro evento. Un evento de varios días puede tener varios, y el aviso los lista TODOS (día, salón,
// evento y horario) para que el Responsable de Eventos hable con el cliente y los resuelva. La API
// los devuelve en el detalle de un 409 al reservar o agendar, y en el aviso preventivo de la consulta.
export const esquemaChoqueDeSalon = z.object({
  // El día del evento pedido que choca.
  fecha: esquemaFecha,
  salon: z.object({ id: esquemaId, nombre: z.string() }),
  // El evento que ocupa el salón ese día.
  evento: z.object({
    id: esquemaId,
    estado: esquemaEstadoEvento,
    cliente: z.string(),
    // Su horario ese día; null si todavía no se agendó (una consulta que no bloquea).
    inicio: esquemaFechaHora.nullable(),
    fin: esquemaFechaHora.nullable(),
  }),
});
export type ChoqueDeSalon = z.infer<typeof esquemaChoqueDeSalon>;

// Respuesta de GET /presupuestos/:id/choques: el aviso preventivo de una consulta.
export const esquemaChoquesDeConsulta = z.object({
  // Cuántos días tiene el evento, para decir «2 de sus 5 días».
  dias: z.number().int().positive(),
  choques: z.array(esquemaChoqueDeSalon),
});
export type ChoquesDeConsulta = z.infer<typeof esquemaChoquesDeConsulta>;
