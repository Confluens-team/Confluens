import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId } from './comunes.esquema.js';
import { esquemaCliente } from './cliente.esquema.js';
import { esquemaDistribucion } from './distribucion.esquema.js';
import { esquemaDiaDeEvento, esquemaEvento } from './evento.esquema.js';
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

// El horario de un día del evento (HU-50). Cada día tiene el suyo; el de un día que termina pasada la
// medianoche termina al día siguiente.
export const esquemaHorarioDeDia = z.object({
  fecha: esquemaFecha,
  inicio: esquemaFechaHora,
  fin: esquemaFechaHora,
});
export type HorarioDeDia = z.infer<typeof esquemaHorarioDeDia>;

export const esquemaAgendarEvento = z
  .object({
    distribuciones: z
      .array(esquemaDistribucionDeSalon)
      .min(1, 'Elegí la distribución de cada salón')
      .refine(
        (lista) => new Set(lista.map((d) => d.salonId)).size === lista.length,
        'Un salón no puede tener dos distribuciones',
      ),
    // HU-50: hay dos formas de pedir el horario. `dias` lleva el de cada día del evento (de 1 a 32, uno
    // por cada día que tiene) y es la de un evento de varios días; `inicio` y `fin` sueltos son la de
    // siempre y valen para un evento de un solo día.
    dias: z.array(esquemaHorarioDeDia).min(1).max(32).optional(),
    inicio: esquemaFechaHora.optional(),
    fin: esquemaFechaHora.optional(),
    modalidadSalonRestaurante: z.boolean().default(false),
    // Si las personas superan la capacidad sumada de las distribuciones, el primer intento sin este
    // flag devuelve 422; el RE reintenta con confirmarCapacidadExcedida: true tras el aviso en UI.
    // Es un aviso y no un tope: la capacidad no bloquea (ADR 0011).
    confirmarCapacidadExcedida: z.boolean().default(false),
  })
  // Con `dias` el horario va dentro de cada día; sin él, `inicio` y `fin` son obligatorios. Corren
  // aunque otro campo ya haya fallado (`when`), así un body vacío informa también del horario; por eso
  // aguantan un body que ni siquiera es un objeto.
  .refine((datos) => !datos?.dias || datos.inicio === undefined, {
    path: ['inicio'],
    message: 'Con `dias` el horario va dentro de cada día',
    when: () => true,
  })
  .refine((datos) => !datos?.dias || datos.fin === undefined, {
    path: ['fin'],
    message: 'Con `dias` el horario va dentro de cada día',
    when: () => true,
  })
  .refine((datos) => !!datos?.dias || datos?.inicio !== undefined, {
    path: ['inicio'],
    message: 'Indicá el horario del evento',
    when: () => true,
  })
  .refine((datos) => !!datos?.dias || datos?.fin !== undefined, {
    path: ['fin'],
    message: 'Indicá el horario del evento',
    when: () => true,
  });
export type AgendarEvento = z.infer<typeof esquemaAgendarEvento>;

/**
 * El horario del pedido en una sola forma: la lista de `dias` tal cual, o el horario suelto de un
 * evento de un solo día (sin `fecha`: es la de su único día, que el servicio conoce).
 */
export function horariosDeAgenda(
  datos: AgendarEvento,
): { fecha?: string; inicio: string; fin: string }[] {
  if (datos.dias) return datos.dias;
  return [{ inicio: datos.inicio!, fin: datos.fin! }];
}

// Presupuesto con sus líneas, mismo shape que PresupuestoDetallado de crear-presupuesto.esquema.ts
// (HU-09), repetido acá para no crear una dependencia cruzada entre módulos de esquemas.
const esquemaPresupuestoConLineas = esquemaPresupuesto.extend({
  lineas: z.array(esquemaLineaPresupuesto),
});

// Respuesta de GET /eventos/:id y de las acciones sobre el evento (agendar/cancelar) y de los
// pagos: el detalle completo que necesita la vista DetalleEvento en un solo pedido.
export const esquemaEventoDetallado = esquemaEvento.extend({
  cliente: esquemaCliente,
  // HU-50: los días del evento con su horario y sus salones, en orden.
  dias: z.array(esquemaDiaDeEvento).min(1),
  // Los salones que ocupa el evento: varios a la vez (ADR 0011), cada uno con la distribución que
  // tiene armada en este evento (null hasta que se agenda). Vacío en una consulta social que
  // todavía no tiene salón (ADR 0008).
  salones: z.array(esquemaSalon.extend({ distribucion: esquemaDistribucion.nullable() })),
  presupuestos: z.array(esquemaPresupuestoConLineas),
  solicitud: esquemaSolicitud.nullable(),
});
export type EventoDetallado = z.infer<typeof esquemaEventoDetallado>;
