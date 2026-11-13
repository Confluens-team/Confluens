import { z } from 'zod';

import { MAXIMO_DE_DIAS_DE_UN_EVENTO } from '../dominio/franja-de-dias.js';
import {
  esquemaCantidadPersonas,
  esquemaFecha,
  esquemaFechaHora,
  esquemaId,
  esquemaImporte,
} from './comunes.esquema.js';
import { esquemaEtiqueta } from './etiqueta.esquema.js';
import { esquemaEstadoEvento } from './evento.esquema.js';
import { exigirDiasSeguidos } from './crear-presupuesto.esquema.js';
import { esquemaLineaPresupuesto, esquemaModalidadServicio } from './linea-presupuesto.esquema.js';
import { esquemaEstadoPresupuesto } from './presupuesto.esquema.js';
import {
  esquemaHoraEstimada,
  esquemaTipoEvento,
  esquemaTipoEventoSocial,
  esquemaTipoJornada,
  esquemaTipoSocialDetalle,
  exigirDetalleDeOtro,
} from './tipo-evento.esquema.js';

// Tipo de cada línea: el salón (siempre la primera), un servicio del catálogo o un adicional que el
// personal escribió a mano. El salón y los adicionales no tienen servicioId.
export const esquemaTipoLinea = z.enum(['salon', 'servicio', 'adicional']);
export type TipoLinea = z.infer<typeof esquemaTipoLinea>;

// Respuesta de GET /presupuestos/:id: lo que necesita la pantalla de una consulta para mostrarla y
// editarla (HU-12). Importes sin IVA (RN-05). `tipoJornada` es la que eligió el cliente o, en los
// eventos anteriores a ADR 0008, la de la línea del salón. Una consulta social puede no tener salón
// y, hasta que el personal arma su presupuesto, tampoco vencimiento (`venceEn` null).
export const esquemaConsultaDetallada = z.object({
  id: esquemaId,
  estado: esquemaEstadoPresupuesto,
  fechaEmision: esquemaFechaHora,
  venceEn: esquemaFechaHora.nullable(),
  total: esquemaImporte,
  requiereFactura: z.boolean(),
  tipoJornada: esquemaTipoJornada,
  // Seguimiento con el cliente: aviso de recepción por WhatsApp y envío formal del PDF. Null: no.
  avisoRecepcionEn: esquemaFechaHora.nullable(),
  envioFormalEn: esquemaFechaHora.nullable(),
  evento: z.object({
    id: esquemaId,
    estado: esquemaEstadoEvento,
    fecha: esquemaFecha,
    // HU-50: el último día del evento. Igual a `fecha` en un evento de un solo día.
    fechaFin: esquemaFecha,
    // Con varios días es la mayor de las cantidades de cada día (el resumen del evento).
    cantidadPersonas: z.number().int().positive(),
    tipo: esquemaTipoEvento,
    tipoSocial: esquemaTipoEventoSocial.nullable(),
    tipoSocialDetalle: z.string().nullable(),
    horaInicioEstimada: esquemaHoraEstimada.nullable(),
    horaFinEstimada: esquemaHoraEstimada.nullable(),
    // Notas de la comanda de cocina: la pantalla de la comanda las muestra y las edita.
    observacionesComanda: z.string().nullable(),
    // HU-11: se completan al agendar el evento; hasta entonces son null. La distribución va en
    // cada salón: un evento puede ocupar varios (ADR 0011).
    inicio: esquemaFechaHora.nullable(),
    fin: esquemaFechaHora.nullable(),
  }),
  // Solo lectura: los datos de contacto los mantiene el cliente desde su cuenta.
  cliente: z.object({
    id: esquemaId,
    nombre: z.string(),
    apellido: z.string().nullable(),
    correo: z.string(),
    telefono: z.string(),
    etiqueta: esquemaEtiqueta.nullable(),
  }),
  // HU-50: los días del evento, en orden. Siempre hay al menos uno. Cada uno trae su fecha, sus
  // personas, su jornada, su horario (null hasta agendar) y sus salones; los servicios y los
  // adicionales de un día son las líneas con su `diaId`.
  dias: z
    .array(
      z.object({
        id: esquemaId,
        fecha: esquemaFecha,
        cantidadPersonas: z.number().int().positive(),
        tipoJornada: esquemaTipoJornada.nullable(),
        inicio: esquemaFechaHora.nullable(),
        fin: esquemaFechaHora.nullable(),
        salones: z.array(
          z.object({
            id: esquemaId,
            nombre: z.string(),
            capacidadMaxima: z.number().int(),
            distribucion: z.object({ id: esquemaId, nombre: z.string() }).nullable(),
          }),
        ),
      }),
    )
    .min(1),
  // Los de todo el evento: la unión de los de cada día. Vacío en una consulta social que todavía no
  // tiene salón (ADR 0008).
  salones: z.array(
    z.object({
      id: esquemaId,
      nombre: z.string(),
      capacidadMaxima: z.number().int(),
      // La que tiene armada en este evento; null hasta que se agenda.
      distribucion: z.object({ id: esquemaId, nombre: z.string() }).nullable(),
    }),
  ),
  lineas: z.array(
    esquemaLineaPresupuesto.extend({
      // HU-50: el día del evento al que pertenece la línea.
      diaId: esquemaId,
      tipo: esquemaTipoLinea,
      tercerizado: z.boolean(),
      // Si el servicio de la línea admite modalidad hoy (RN-11): la pantalla ofrece el selector.
      admiteModalidad: z.boolean(),
    }),
  ),
});
export type ConsultaDetallada = z.infer<typeof esquemaConsultaDetallada>;

// Un salón del evento. Como en los servicios, sin `precioUnitario` conserva el precio congelado
// si el salón ya estaba, o toma el vigente según la jornada si es nuevo; con él es un ajuste
// comercial (RN-03). Reemplaza al par salonId + precioSalon de cuando el evento tenía un salón.
export const esquemaSalonModificado = z.object({
  salonId: esquemaId,
  precioUnitario: esquemaImporte.optional(),
});
export type SalonModificado = z.infer<typeof esquemaSalonModificado>;

// Un servicio del presupuesto modificado. Sin `precioUnitario` conserva el precio congelado si ya
// estaba en el presupuesto, o toma el vigente si es nuevo; con él es un ajuste comercial (RN-03).
// Un tercerizado a cotizar sin `precioUnitario` sigue a cotizar; con él, queda con ese precio.
// Como el PATCH manda el estado completo de la consulta, `horaEstimada` ausente borra la hora que
// tuviera la línea.
// RN-11: `precioUnitario` es el precio base, antes del recargo de la modalidad; el recargo lo suma
// la API. Sin `modalidad`, Normal.
export const esquemaServicioModificado = z.object({
  servicioId: esquemaId,
  cantidad: z.number().int().positive(),
  precioUnitario: esquemaImporte.optional(),
  horaEstimada: esquemaHoraEstimada.optional(),
  modalidad: esquemaModalidadServicio.optional(),
});
export type ServicioModificado = z.infer<typeof esquemaServicioModificado>;

// Un adicional que no está en el catálogo: el personal escribe qué es y cuánto cuesta (sin IVA).
export const esquemaAdicional = z.object({
  descripcion: z.string().trim().min(1).max(120),
  cantidad: z.number().int().positive(),
  precioUnitario: esquemaImporte,
  horaEstimada: esquemaHoraEstimada.optional(),
});
export type Adicional = z.infer<typeof esquemaAdicional>;

// Los servicios de un mismo día no se repiten con la misma modalidad.
const sinServiciosRepetidos = (servicios: { servicioId: number; modalidad?: string }[]) =>
  new Set(servicios.map((s) => `${s.servicioId}:${s.modalidad ?? 'Normal'}`)).size ===
  servicios.length;

const MENSAJE_SERVICIO_REPETIDO = 'Un servicio no puede aparecer dos veces con la misma modalidad';

// Un día del presupuesto modificado (HU-50): el estado completo de ese día, con sus propios salones,
// servicios y adicionales. Lo que cambia de un día a otro (salones, personas, jornada, servicios) se
// carga acá; lo que es de todo el evento (tipo, horas estimadas) queda afuera.
export const esquemaDiaModificado = z.object({
  fecha: esquemaFecha,
  cantidadPersonas: esquemaCantidadPersonas,
  tipoJornada: esquemaTipoJornada,
  salones: z
    .array(esquemaSalonModificado)
    .default([])
    .refine(
      (salones) => new Set(salones.map((s) => s.salonId)).size === salones.length,
      'Un salón no puede aparecer dos veces',
    ),
  servicios: z
    .array(esquemaServicioModificado)
    .default([])
    .refine(sinServiciosRepetidos, MENSAJE_SERVICIO_REPETIDO),
  adicionales: z.array(esquemaAdicional).default([]),
});
export type DiaModificado = z.infer<typeof esquemaDiaModificado>;

// Body de PATCH /presupuestos/:id (HU-12): el estado completo de la consulta, no un parche parcial.
// `precioSalon` ajusta a mano el precio de la línea del salón. `salonId` null solo vale para una
// consulta social (ADR 0008). Sin `tipo` (ni los demás campos del tipo) se mantiene lo que estaba.
//
// HU-50: como al crear, hay dos formas equivalentes para un solo día. `dias` lleva un elemento por
// día (de 1 a 32, seguidos y en orden) y es la que cambia la franja: cada día se identifica por su
// fecha, así que sumar o sacar un día en un extremo es mandar una fecha de más o de menos. La de
// siempre, con `fecha`, `salones`, `cantidadPersonas`, `tipoJornada`, `servicios` y `adicionales`
// sueltos, es un evento de un solo día. `diasDeModificacion` las lleva a la misma forma.
export const esquemaModificarPresupuesto = z
  .object({
    dias: z.array(esquemaDiaModificado).min(1).max(MAXIMO_DE_DIAS_DE_UN_EVENTO).optional(),
    // Los campos sueltos de un solo día. Excluyen a `dias`.
    fecha: esquemaFecha.optional(),
    // Vacío solo vale para una consulta social todavía sin salón (ADR 0008).
    salones: z
      .array(esquemaSalonModificado)
      .default([])
      .refine(
        (salones) => new Set(salones.map((s) => s.salonId)).size === salones.length,
        'Un salón no puede aparecer dos veces',
      ),
    cantidadPersonas: esquemaCantidadPersonas.optional(),
    tipoJornada: esquemaTipoJornada.optional(),
    tipo: esquemaTipoEvento.optional(),
    tipoSocial: esquemaTipoEventoSocial.nullable().optional(),
    tipoSocialDetalle: esquemaTipoSocialDetalle.nullable().optional(),
    horaInicioEstimada: esquemaHoraEstimada.nullable().optional(),
    // Igual que la de inicio: sin el campo se mantiene, null la borra.
    horaFinEstimada: esquemaHoraEstimada.nullable().optional(),
    // HU-53: la marca de factura ya no se elige. Un presupuesto nuevo nace con factura y uno anterior
    // conserva la suya (RN-01), así que no viaja en la modificación.
    // Un mismo servicio puede ir más de una vez, con una modalidad distinta en cada línea (un coffee
    // normal a la mañana y uno continuo a la tarde; decisión del equipo, 16/10/2026). Lo que sigue
    // abierto (S-09) es si una sola línea puede llevar los dos recargos.
    servicios: z.array(esquemaServicioModificado).default([]).refine(sinServiciosRepetidos, {
      message: MENSAJE_SERVICIO_REPETIDO,
    }),
    adicionales: z.array(esquemaAdicional).default([]),
  })
  .superRefine((datos, ctx) => {
    if (datos.dias) {
      for (const campo of ['fecha', 'cantidadPersonas', 'tipoJornada'] as const) {
        if (datos[campo] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [campo],
            message: 'Con `dias` los datos van dentro de cada día',
          });
        }
      }
      for (const campo of ['salones', 'servicios', 'adicionales'] as const) {
        if (datos[campo].length > 0) {
          ctx.addIssue({
            code: 'custom',
            path: [campo],
            message: 'Con `dias` esto va dentro de cada día',
          });
        }
      }
      exigirDiasSeguidos(datos.dias, ctx);
      if (datos.tipo === 'Corporativo') {
        datos.dias.forEach((dia, i) => {
          if (dia.salones.length === 0) {
            ctx.addIssue({
              code: 'custom',
              path: ['dias', i, 'salones'],
              message: 'Un evento corporativo necesita al menos un salón por día',
            });
          }
        });
      }
    } else {
      // Un solo día, a la manera de siempre: los campos obligatorios son los de un día.
      const resultado = esquemaDiaModificado
        .pick({ fecha: true, cantidadPersonas: true, tipoJornada: true })
        .safeParse({
          fecha: datos.fecha,
          cantidadPersonas: datos.cantidadPersonas,
          tipoJornada: datos.tipoJornada,
        });
      if (!resultado.success) {
        for (const problema of resultado.error.issues) {
          ctx.addIssue({ code: 'custom', path: problema.path, message: problema.message });
        }
      }
      if (datos.tipo === 'Corporativo' && datos.salones.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['salones'],
          message: 'Un evento corporativo necesita al menos un salón',
        });
      }
    }
    if (datos.tipo === 'Social' && !datos.tipoSocial) {
      ctx.addIssue({
        code: 'custom',
        path: ['tipoSocial'],
        message: 'Elegí qué tipo de evento social es',
      });
    }
    exigirDetalleDeOtro(datos, ctx);
  });
export type ModificarPresupuesto = z.infer<typeof esquemaModificarPresupuesto>;

/** Lo que dejan los campos sueltos de un solo día: lo mismo que `ModificarPresupuesto` de antes. */
export type ModificarPresupuestoDeUnDia = Omit<
  ModificarPresupuesto,
  'dias' | 'fecha' | 'cantidadPersonas' | 'tipoJornada'
> &
  Pick<DiaModificado, 'fecha' | 'cantidadPersonas' | 'tipoJornada'>;

/**
 * Los días de un pedido de modificación, en una sola forma: `dias` tal cual, o el único día que
 * describen los campos sueltos. El esquema ya garantiza que una de las dos formas está completa.
 */
export function diasDeModificacion(datos: ModificarPresupuesto): DiaModificado[] {
  if (datos.dias) return datos.dias;
  return [
    {
      fecha: datos.fecha!,
      cantidadPersonas: datos.cantidadPersonas!,
      tipoJornada: datos.tipoJornada!,
      salones: datos.salones,
      servicios: datos.servicios,
      adicionales: datos.adicionales,
    },
  ];
}

/**
 * El pedido de un solo día con los campos sueltos de siempre, para el camino que no cambió. Si el
 * pedido trae más de un día no se puede reducir a uno: quien lo llama decide antes cuál camino sigue.
 */
export function aModificacionDeUnDia(datos: ModificarPresupuesto): ModificarPresupuestoDeUnDia {
  const [dia] = diasDeModificacion(datos);
  const { dias: _dias, ...resto } = datos;
  return { ...resto, ...dia! };
}
