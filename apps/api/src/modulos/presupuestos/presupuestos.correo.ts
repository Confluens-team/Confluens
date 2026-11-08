import {
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  etiquetaTipoEvento,
  type ModalidadServicio,
  NOMBRE_MODALIDAD,
  PORCENTAJE_IVA,
  type TipoEvento,
  type TipoEventoSocial,
  type TipoJornada,
  ZONA_HORARIA_EVENTOS,
} from '@confluens/shared';

import { type Correo, enviarCorreo } from '../../lib/correo.js';

// Correo de confirmación de la consulta (Sprint 5, definición del PO del 07/11/2026): se manda solo
// cuando el cliente confirma su consulta, con el resumen en el cuerpo y sin adjunto. El PDF se
// descarga desde el cotizador. Lo mandan la consulta corporativa (con precios) y la social (sin
// precios, ADR 0008): las dos son la confirmación de la consulta (PO, 07/11/2026).

type Importe = number | string | { toString(): string };

export interface DatosCorreoConsulta {
  // Nombre de pila del cliente, para el saludo.
  nombre: string;
  correo: string;
  presupuesto: {
    id: number;
    total: Importe;
    venceEn: Date | null;
    evento: { fecha: Date; cantidadPersonas: number };
    lineas: {
      descripcion: string;
      cantidad: number;
      subtotal: Importe;
      modalidad: ModalidadServicio;
      aCotizar: boolean;
      horaEstimada: string | null;
    }[];
  };
}

const PESOS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const pesos = (importe: Importe) => PESOS.format(Number(importe.toString()));

// Evento.fecha es una fecha de calendario (@db.Date): se lee en UTC para no correrla un día.
const FECHA_EVENTO = new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeZone: 'UTC' });
// venceEn es un instante: se lee en la zona de los eventos, no en la del contenedor (ADR 0010).
const FECHA_VENCIMIENTO = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long',
  timeZone: ZONA_HORARIA_EVENTOS,
});

// RN-06 y ADR 0007: la reserva la dispara el pago de la seña, no la consulta.
const AVISO_RESERVA = 'Esto no reserva el salón: la reserva se confirma con el pago de la seña.';

const escapar = (texto: string) =>
  texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function correoDeConsulta({ nombre, correo, presupuesto }: DatosCorreoConsulta): Correo {
  const { id, evento, lineas, venceEn } = presupuesto;
  const { subtotal, iva, total } = desglosarIva(presupuesto.total.toString());
  const fecha = FECHA_EVENTO.format(evento.fecha);
  const vigencia = venceEn
    ? `Este presupuesto estimado es válido por ${DIAS_VIGENCIA_PRESUPUESTO} días, hasta el ${FECHA_VENCIMIENTO.format(venceEn)}.`
    : `Este presupuesto estimado es válido por ${DIAS_VIGENCIA_PRESUPUESTO} días.`;
  const detalle = lineas.map((linea) => {
    const hora = linea.horaEstimada ? ` (${linea.horaEstimada} h)` : '';
    const cantidad = linea.cantidad > 1 ? ` x ${linea.cantidad}` : '';
    // RN-11: el precio ya incluye el recargo, así que la modalidad tiene que verse.
    const modalidad = linea.modalidad === 'Normal' ? '' : ` - ${NOMBRE_MODALIDAD[linea.modalidad]}`;
    return {
      texto: `${linea.descripcion}${modalidad}${hora}${cantidad}`,
      importe: linea.aCotizar ? 'A cotizar' : pesos(linea.subtotal),
    };
  });
  const aviso = AVISO_RESERVA;

  const asunto = `Recibimos tu consulta N° ${id} en Los Abuelos`;
  const texto = [
    `Hola ${nombre}, recibimos tu consulta.`,
    '',
    `Fecha del evento: ${fecha}`,
    `Personas: ${evento.cantidadPersonas}`,
    '',
    ...detalle.map(({ texto: linea, importe }) => `- ${linea}: ${importe}`),
    '',
    `Subtotal: ${pesos(subtotal)}`,
    `IVA ${PORCENTAJE_IVA}%: ${pesos(iva)}`,
    `Total: ${pesos(total)}`,
    '',
    vigencia,
    aviso,
  ].join('\n');
  const html =
    `<p>Hola ${escapar(nombre)}, recibimos tu consulta.</p>` +
    `<p>Fecha del evento: <strong>${escapar(fecha)}</strong><br>Personas: <strong>${evento.cantidadPersonas}</strong></p>` +
    '<table cellpadding="4" cellspacing="0">' +
    detalle
      .map(
        ({ texto: linea, importe }) =>
          `<tr><td>${escapar(linea)}</td><td align="right">${escapar(importe)}</td></tr>`,
      )
      .join('') +
    `<tr><td>Subtotal</td><td align="right">${pesos(subtotal)}</td></tr>` +
    `<tr><td>IVA ${PORCENTAJE_IVA}%</td><td align="right">${pesos(iva)}</td></tr>` +
    `<tr><td><strong>Total</strong></td><td align="right"><strong>${pesos(total)}</strong></td></tr>` +
    '</table>' +
    `<p>${vigencia}</p>` +
    `<p>${aviso}</p>`;
  return { para: correo, asunto, texto, html };
}

export interface DatosCorreoConsultaSocial {
  // Nombre de pila del cliente, para el saludo.
  nombre: string;
  correo: string;
  presupuesto: {
    id: number;
    evento: {
      fecha: Date;
      cantidadPersonas: number;
      tipo: TipoEvento;
      tipoSocial: TipoEventoSocial | null;
      tipoSocialDetalle: string | null;
      tipoJornada: TipoJornada | null;
      horaInicioEstimada: string | null;
    };
  };
}

const NOMBRE_JORNADA: Record<TipoJornada, string> = {
  completa: 'Jornada completa',
  media: 'Media jornada',
};

// ADR 0008: la consulta social no tiene salón, servicios ni precio. El resumen repite lo que contó
// el cliente y avisa que el presupuesto lo arma el equipo después.
export function correoDeConsultaSocial({
  nombre,
  correo,
  presupuesto,
}: DatosCorreoConsultaSocial): Correo {
  const { id, evento } = presupuesto;
  const datos = [
    ['Tipo de evento', etiquetaTipoEvento(evento)],
    ['Fecha del evento', FECHA_EVENTO.format(evento.fecha)],
    ['Personas', String(evento.cantidadPersonas)],
    ...(evento.tipoJornada ? [['Jornada', NOMBRE_JORNADA[evento.tipoJornada]]] : []),
    ...(evento.horaInicioEstimada
      ? [['Hora estimada de inicio', `${evento.horaInicioEstimada} h`]]
      : []),
  ] as [string, string][];
  const aviso =
    'Todavía no tiene precio: nuestro equipo arma el presupuesto a partir de tu consulta.';

  const asunto = `Recibimos tu consulta N° ${id} en Los Abuelos`;
  const texto = [
    `Hola ${nombre}, recibimos tu consulta.`,
    '',
    ...datos.map(([campo, valor]) => `${campo}: ${valor}`),
    '',
    aviso,
    AVISO_RESERVA,
  ].join('\n');
  const html =
    `<p>Hola ${escapar(nombre)}, recibimos tu consulta.</p>` +
    '<table cellpadding="4" cellspacing="0">' +
    datos
      .map(
        ([campo, valor]) => `<tr><td>${campo}</td><td><strong>${escapar(valor)}</strong></td></tr>`,
      )
      .join('') +
    '</table>' +
    `<p>${aviso}</p>` +
    `<p>${AVISO_RESERVA}</p>`;
  return { para: correo, asunto, texto, html };
}

// Nunca rechaza: si el armado o el envío fallan, la consulta ya está guardada, así que se registra
// el error y no se le devuelve al cliente.
async function enviarSinFallar(
  armar: () => Correo,
  consultaId: number,
  enviar: (correo: Correo) => Promise<void>,
): Promise<void> {
  try {
    await enviar(armar());
  } catch (error) {
    console.error(
      `No se pudo enviar el correo de la consulta ${consultaId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Avisa al cliente que recibimos su consulta. Nunca rechaza (ver enviarSinFallar). Quien la llama no
 * hace `await` para no frenar la respuesta del cotizador.
 */
export async function avisarConsultaRecibida(
  datos: DatosCorreoConsulta,
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
): Promise<void> {
  await enviarSinFallar(() => correoDeConsulta(datos), datos.presupuesto.id, enviar);
}

/** Lo mismo que `avisarConsultaRecibida`, para la consulta social. */
export async function avisarConsultaSocialRecibida(
  datos: DatosCorreoConsultaSocial,
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
): Promise<void> {
  await enviarSinFallar(() => correoDeConsultaSocial(datos), datos.presupuesto.id, enviar);
}
