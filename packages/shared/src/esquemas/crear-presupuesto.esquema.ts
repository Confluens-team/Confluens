import { z } from 'zod';

import { esquemaFecha, esquemaId } from './comunes.esquema.js';
import { esquemaEvento } from './evento.esquema.js';
import { esquemaLineaPresupuesto } from './linea-presupuesto.esquema.js';
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
});
export type ServicioSeleccionado = z.infer<typeof esquemaServicioSeleccionado>;

// Contrato de POST /presupuestos (HU-09). Lo usa el panel interno del Responsable de Eventos, no
// el canal público, así que a diferencia de esquemaCrearSolicitud no hace falta un mensaje de Zod
// en español por campo.
export const esquemaCrearPresupuesto = z.object({
  // Datos de contacto del cliente: si ya existe un Cliente con este correo se reutiliza (estos
  // campos no lo actualizan); si no existe, se crea con estos valores.
  nombre: z.string().min(1),
  telefono: z.string().min(1),
  correo: z.email(),
  // Datos del evento en consulta que se crea junto con el presupuesto.
  salonId: esquemaId,
  fecha: esquemaFecha,
  cantidadPersonas: z.number().int().positive(),
  tipoJornada: esquemaTipoJornada,
  horaInicioEstimada: esquemaHoraEstimada.optional(),
  // Puede venir vacío: un presupuesto solo con el salón es válido.
  servicios: z.array(esquemaServicioSeleccionado).default([]),
  // HU-15: si viene, vincula Solicitud.eventoId al evento recién creado (el RE "tomó" esa
  // solicitud). Opcional porque el RE también puede armar un presupuesto sin partir de una
  // solicitud existente.
  solicitudId: esquemaId.optional(),
});
export type CrearPresupuesto = z.infer<typeof esquemaCrearPresupuesto>;

// Contrato de POST /presupuestos/social (ADR 0008): la consulta de un evento social. Sin salón ni
// servicios: el presupuesto lo arma el Responsable de Eventos. Sin datos de contacto: el cliente
// es el de la sesión. Lo completa el cliente, así que los mensajes van en español.
export const esquemaCrearConsultaSocial = z
  .object({
    fecha: esquemaFecha,
    cantidadPersonas: z
      .number('Ingresá la cantidad de personas')
      .int('Ingresá un número entero')
      .positive('Ingresá la cantidad de personas'),
    tipoJornada: esquemaTipoJornada,
    horaInicioEstimada: esquemaHoraEstimada.optional(),
    tipoSocial: esquemaTipoEventoSocial,
    tipoSocialDetalle: esquemaTipoSocialDetalle.optional(),
    solicitudId: esquemaId.optional(),
  })
  .superRefine(exigirDetalleDeOtro);
export type CrearConsultaSocial = z.infer<typeof esquemaCrearConsultaSocial>;

// Respuesta de POST /presupuestos: el presupuesto recién creado con su evento y el detalle de
// líneas, compuesto ad-hoc para esta respuesta puntual (esquemaPresupuesto se mantiene "plano"
// para el resto de usos, sin anidar la relación).
export const esquemaPresupuestoDetallado = esquemaPresupuesto.extend({
  evento: esquemaEvento,
  lineas: z.array(esquemaLineaPresupuesto),
});
export type PresupuestoDetallado = z.infer<typeof esquemaPresupuestoDetallado>;
