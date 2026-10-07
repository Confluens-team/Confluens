import { z } from 'zod';

import { esquemaFecha, esquemaFechaHora, esquemaId } from './comunes.esquema.js';

// clienteId es null mientras el formulario no requiera autenticación (Sprint 1).
// Mensajes en español en los campos de contacto: llegan directo al formulario público (HU-14,
// criterio 5), a diferencia de campos internos donde el error genérico de Zod alcanza.
export const esquemaSolicitud = z.object({
  id: esquemaId,
  clienteId: esquemaId.nullable(),
  nombre: z.string().min(1, 'Ingresá tu nombre y apellido'),
  telefono: z.string().min(1, 'Ingresá un teléfono de contacto'),
  correo: z.email('Ingresá un correo válido'),
  fechaDeseada: esquemaFecha,
  cantidadPersonas: z.number().int().positive('Ingresá una cantidad mayor a 0'), // estimada
  salonId: esquemaId.nullable(), // salón de interés elegido en la landing (HU-07)
  descartada: z.boolean(),
  eventoId: esquemaId.nullable(), // evento EnConsulta en el que se convirtió
  creadoEn: esquemaFechaHora,
  actualizadoEn: esquemaFechaHora,
});
export type Solicitud = z.infer<typeof esquemaSolicitud>;

// Contrato de POST /solicitudes (HU-14): el formulario público solo manda datos de contacto,
// fecha deseada, cantidad estimada y —desde HU-07— el salón que venía preseleccionado. clienteId
// lo decide el servidor (null en Sprint 1, sin autenticación); descartada y eventoId los
// administra el Responsable de Eventos después, al tomar la solicitud — no vienen del formulario.
// salonId es opcional además de nullable: al formulario se puede llegar desde la ficha de un salón
// (lo manda) o directo desde el menú (no lo manda), y ambas formas son válidas.
export const esquemaCrearSolicitud = esquemaSolicitud
  .omit({
    id: true,
    clienteId: true,
    descartada: true,
    eventoId: true,
    creadoEn: true,
    actualizadoEn: true,
  })
  .extend({ salonId: esquemaId.nullable().optional() });
export type CrearSolicitud = z.infer<typeof esquemaCrearSolicitud>;
