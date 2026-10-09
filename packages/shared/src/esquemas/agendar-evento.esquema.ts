import { z } from 'zod';

import { esquemaFechaHora, esquemaId } from './comunes.esquema.js';
import { esquemaCliente } from './cliente.esquema.js';
import { esquemaDistribucion } from './distribucion.esquema.js';
import { esquemaEvento } from './evento.esquema.js';
import { esquemaLineaPresupuesto } from './linea-presupuesto.esquema.js';
import { esquemaPresupuesto } from './presupuesto.esquema.js';
import { esquemaSalon } from './salon.esquema.js';
import { esquemaSolicitud } from './solicitud.esquema.js';

// Contrato de POST /eventos/:id/agendar (HU-13). Fija distribución, horario y modalidad del evento
// SIN cambiar su estado: queda EnConsulta. La reserva la dispara el pago que cruza el 20% de la
// base de cobro (HU-13 / HU-14), no esta llamada. Agendar es el paso previo obligatorio: sin
// inicio y fin cargados no se puede evaluar el solapamiento de RN-12 al momento de reservar.
// La distribución (el armado) de cada salón del evento: una distribución pertenece a un salón, y
// un evento puede ocupar varios a la vez (ADR 0011). Tiene que venir una por cada salón.
export const esquemaDistribucionDeSalon = z.object({
  salonId: esquemaId,
  distribucionId: esquemaId,
});
export type DistribucionDeSalon = z.infer<typeof esquemaDistribucionDeSalon>;

export const esquemaAgendarEvento = z.object({
  distribuciones: z
    .array(esquemaDistribucionDeSalon)
    .min(1, 'Elegí la distribución de cada salón')
    .refine(
      (lista) => new Set(lista.map((d) => d.salonId)).size === lista.length,
      'Un salón no puede tener dos distribuciones',
    ),
  inicio: esquemaFechaHora,
  fin: esquemaFechaHora,
  modalidadSalonRestaurante: z.boolean().default(false),
  // Si las personas superan la capacidad sumada de las distribuciones, el primer intento sin este
  // flag devuelve 422; el RE reintenta con confirmarCapacidadExcedida: true tras el aviso en UI.
  // Es un aviso y no un tope: la capacidad no bloquea (ADR 0011).
  confirmarCapacidadExcedida: z.boolean().default(false),
});
export type AgendarEvento = z.infer<typeof esquemaAgendarEvento>;

// Presupuesto con sus líneas, mismo shape que PresupuestoDetallado de crear-presupuesto.esquema.ts
// (HU-09), repetido acá para no crear una dependencia cruzada entre módulos de esquemas.
const esquemaPresupuestoConLineas = esquemaPresupuesto.extend({
  lineas: z.array(esquemaLineaPresupuesto),
});

// Respuesta de GET /eventos/:id y de las acciones sobre el evento (agendar/cancelar) y de los
// pagos: el detalle completo que necesita la vista DetalleEvento en un solo pedido.
export const esquemaEventoDetallado = esquemaEvento.extend({
  cliente: esquemaCliente,
  // Los salones que ocupa el evento: varios a la vez (ADR 0011), cada uno con la distribución que
  // tiene armada en este evento (null hasta que se agenda). Vacío en una consulta social que
  // todavía no tiene salón (ADR 0008).
  salones: z.array(esquemaSalon.extend({ distribucionId: esquemaId.nullable() })),
  distribucion: esquemaDistribucion.nullable(),
  presupuestos: z.array(esquemaPresupuestoConLineas),
  solicitud: esquemaSolicitud.nullable(),
});
export type EventoDetallado = z.infer<typeof esquemaEventoDetallado>;
