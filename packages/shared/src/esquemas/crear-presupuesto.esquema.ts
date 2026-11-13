import { z } from 'zod';

import {
  MAXIMO_DE_DIAS_DE_UN_EVENTO,
  MENSAJE_FRANJA_MUY_LARGA,
  validarFechasSeguidas,
  validarFranja,
} from '../dominio/franja-de-dias.js';
import { esquemaCantidadPersonas, esquemaFecha, esquemaId } from './comunes.esquema.js';
import { esquemaEvento } from './evento.esquema.js';
import { esquemaLineaPresupuesto, esquemaModalidadServicio } from './linea-presupuesto.esquema.js';
import { esquemaPresupuesto } from './presupuesto.esquema.js';
import {
  esquemaHoraEstimada,
  esquemaTipoEventoSocial,
  esquemaTipoJornada,
  esquemaTipoSocialDetalle,
  exigirDetalleDeOtro,
} from './tipo-evento.esquema.js';

// RN-04: un servicio puede contratarse para menos personas que el total del evento.
// `horaEstimada` es opcional: a qué hora del evento se espera ese servicio. Si el evento ya está
// agendado, la API valida que caiga dentro de su horario.
export const esquemaServicioSeleccionado = z.object({
  servicioId: esquemaId,
  cantidad: z.number().int().positive(),
  horaEstimada: esquemaHoraEstimada.optional(),
  // RN-11: sin el campo, Normal. Continuo o en mesa solo en un servicio que admite modalidad.
  modalidad: esquemaModalidadServicio.optional(),
});
export type ServicioSeleccionado = z.infer<typeof esquemaServicioSeleccionado>;

// Un día del cotizador corporativo (HU-50): cada día tiene su fecha, su cantidad de personas, su
// jornada, sus salones y sus servicios, y los de un día pueden ser distintos de los de otro. La hora
// de inicio estimada no es del día sino de todo el evento (ver `esquemaCrearPresupuesto`).
// Un evento puede ocupar varios salones a la vez, hasta los cinco (ADR 0011).
export const esquemaDiaCotizado = z.object({
  fecha: esquemaFecha,
  cantidadPersonas: esquemaCantidadPersonas,
  tipoJornada: esquemaTipoJornada,
  salonIds: z
    .array(esquemaId)
    .min(1, 'Elegí al menos un salón')
    .refine((ids) => new Set(ids).size === ids.length, 'Un salón no puede repetirse'),
  // Puede venir vacío: un día solo con el salón es válido.
  servicios: z.array(esquemaServicioSeleccionado).default([]),
});
export type DiaCotizado = z.infer<typeof esquemaDiaCotizado>;

// Las fechas de `dias` tienen que ser una franja (HU-50): seguidas, en orden y hasta 32. La API lo
// controla acá y la base lo vuelve a garantizar.
export function exigirDiasSeguidos(
  dias: { fecha: string }[],
  ctx: z.RefinementCtx,
  campo: string = 'dias',
) {
  const resultado = validarFechasSeguidas(dias.map((dia) => dia.fecha));
  if (resultado.valida) return;
  const mensaje =
    resultado.motivo === 'supera-el-maximo'
      ? MENSAJE_FRANJA_MUY_LARGA
      : resultado.motivo === 'fecha-invalida'
        ? 'Alguna fecha no es válida'
        : 'Los días del evento tienen que ser consecutivos y estar en orden';
  ctx.addIssue({ code: 'custom', path: [campo], message: mensaje });
}

// Contrato de POST /presupuestos (HU-09). Lo usa el panel interno del Responsable de Eventos y el
// cotizador del cliente, así que a diferencia de esquemaCrearSolicitud no hace falta un mensaje de
// Zod en español por campo.
//
// HU-50: el evento puede durar de 1 a 32 días. Hay dos formas de pedirlo, equivalentes para un solo
// día: `dias` (la nueva, un elemento por día) o los campos sueltos `fecha`, `cantidadPersonas`,
// `tipoJornada`, `salonIds` y `servicios` (la de siempre, que es un evento de un solo día).
// `diasDeCotizacion` las lleva a la misma forma.
export const esquemaCrearPresupuesto = z
  .object({
    // Datos de contacto del cliente. Cuando cotiza el personal: si ya existe un Cliente con este
    // correo se reutiliza (estos campos no lo actualizan); si no existe, se crea con estos valores.
    // Cuando cotiza un CLIENTE se ignoran y se usa la ficha de su sesión (A1 de la auditoría).
    // Topes de largo: M1 de la auditoría de seguridad, igual que esquemaCrearSolicitud.
    nombre: z.string().min(1).max(100),
    telefono: z.string().min(1).max(30),
    correo: z.email().max(254),
    // Los días del evento, en orden y seguidos. Excluye a los campos sueltos de un día.
    dias: z.array(esquemaDiaCotizado).min(1).max(MAXIMO_DE_DIAS_DE_UN_EVENTO).optional(),
    // Forma de un solo día. El cotizador corporativo manda al menos un salón; la consulta social va
    // por otro endpoint y llega sin salón.
    salonIds: esquemaDiaCotizado.shape.salonIds.optional(),
    fecha: esquemaFecha.optional(),
    cantidadPersonas: esquemaCantidadPersonas.optional(),
    tipoJornada: esquemaTipoJornada.optional(),
    // La hora estimada de inicio es una sola para todo el evento (HU-50, parte 2): el horario exacto
    // de cada día lo fija el Responsable de Eventos al agendar.
    horaInicioEstimada: esquemaHoraEstimada.optional(),
    // Puede venir vacío: un presupuesto solo con el salón es válido.
    servicios: z.array(esquemaServicioSeleccionado).default([]),
    // HU-15: si viene, vincula Solicitud.eventoId al evento recién creado (el RE "tomó" esa
    // solicitud). Opcional porque el RE también puede armar un presupuesto sin partir de una
    // solicitud existente.
    solicitudId: esquemaId.optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.dias) {
      const sueltos = ['fecha', 'cantidadPersonas', 'tipoJornada', 'salonIds'] as const;
      for (const campo of sueltos) {
        if (datos[campo] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [campo],
            message: 'Con `dias` los datos van dentro de cada día',
          });
        }
      }
      if (datos.servicios.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['servicios'],
          message: 'Con `dias` los servicios van dentro de cada día',
        });
      }
      exigirDiasSeguidos(datos.dias, ctx);
      return;
    }
    // Un solo día, a la manera de siempre: se valida con el mismo esquema del día, así los mensajes
    // y los campos de cada error son los de antes.
    const resultado = esquemaDiaCotizado.safeParse({
      fecha: datos.fecha,
      cantidadPersonas: datos.cantidadPersonas,
      tipoJornada: datos.tipoJornada,
      salonIds: datos.salonIds,
      servicios: datos.servicios,
    });
    if (resultado.success) return;
    for (const problema of resultado.error.issues) {
      ctx.addIssue({ code: 'custom', path: problema.path, message: problema.message });
    }
  });
export type CrearPresupuesto = z.infer<typeof esquemaCrearPresupuesto>;

/**
 * Los días de un pedido de cotización, en una sola forma: `dias` tal cual, o el único día que
 * describen los campos sueltos. El esquema ya garantiza que una de las dos formas está completa.
 */
export function diasDeCotizacion(datos: CrearPresupuesto): DiaCotizado[] {
  if (datos.dias) return datos.dias;
  return [
    {
      fecha: datos.fecha!,
      cantidadPersonas: datos.cantidadPersonas!,
      tipoJornada: datos.tipoJornada!,
      salonIds: datos.salonIds!,
      servicios: datos.servicios,
    },
  ];
}

// Contrato de POST /presupuestos/social (ADR 0008): la consulta de un evento social. Sin salón ni
// servicios: el presupuesto lo arma el Responsable de Eventos. Sin datos de contacto: el cliente
// es el de la sesión. Lo completa el cliente, así que los mensajes van en español.
export const esquemaCrearConsultaSocial = z
  .object({
    // El día de inicio. Con `fechaFin`, el evento dura varios días (HU-50).
    fecha: esquemaFecha,
    // HU-50: el último día del evento, de 1 a 32 días contando el de inicio y el de fin. Sin él, el
    // evento dura un solo día. Los días entran vacíos: sin salón ni servicios (ADR 0008).
    fechaFin: esquemaFecha.optional(),
    cantidadPersonas: esquemaCantidadPersonas,
    tipoJornada: esquemaTipoJornada,
    horaInicioEstimada: esquemaHoraEstimada.optional(),
    // Hasta cuándo se espera que dure. Si termina antes de la hora de inicio, es el día siguiente.
    horaFinEstimada: esquemaHoraEstimada.optional(),
    tipoSocial: esquemaTipoEventoSocial,
    tipoSocialDetalle: esquemaTipoSocialDetalle.optional(),
    solicitudId: esquemaId.optional(),
  })
  .superRefine(exigirDetalleDeOtro)
  .superRefine((datos, ctx) => {
    if (!datos.fechaFin) return;
    const franja = validarFranja(datos.fecha, datos.fechaFin);
    if (franja.valida) return;
    ctx.addIssue({
      code: 'custom',
      path: ['fechaFin'],
      message:
        franja.motivo === 'supera-el-maximo'
          ? MENSAJE_FRANJA_MUY_LARGA
          : franja.motivo === 'fin-anterior-al-inicio'
            ? 'El día de fin no puede ser anterior al de inicio'
            : 'Fecha inválida',
    });
  })
  .superRefine((datos, ctx) => {
    if (!datos.horaFinEstimada) return;
    if (!datos.horaInicioEstimada) {
      ctx.addIssue({
        code: 'custom',
        path: ['horaInicioEstimada'],
        message: 'Indicá también la hora de inicio',
      });
    } else if (datos.horaFinEstimada === datos.horaInicioEstimada) {
      ctx.addIssue({
        code: 'custom',
        path: ['horaFinEstimada'],
        message: 'La hora de fin tiene que ser distinta de la de inicio',
      });
    }
  });
export type CrearConsultaSocial = z.infer<typeof esquemaCrearConsultaSocial>;

// Respuesta de POST /presupuestos: el presupuesto recién creado con su evento y el detalle de
// líneas, compuesto ad-hoc para esta respuesta puntual (esquemaPresupuesto se mantiene "plano"
// para el resto de usos, sin anidar la relación).
export const esquemaPresupuestoDetallado = esquemaPresupuesto.extend({
  evento: esquemaEvento,
  lineas: z.array(esquemaLineaPresupuesto),
});
export type PresupuestoDetallado = z.infer<typeof esquemaPresupuestoDetallado>;
