import {
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  type ModalidadServicio,
  NOMBRE_MODALIDAD,
  PORCENTAJE_IVA,
  ZONA_HORARIA_EVENTOS,
} from '@confluens/shared';

import { type Correo, enviarCorreo } from '../../lib/correo.js';

// Correo de confirmación de la consulta (Sprint 5, definición del PO del 07/11/2026): se manda solo
// cuando el cliente confirma su consulta en el cotizador, con el resumen en el cuerpo y sin adjunto.
// El PDF se descarga desde el cotizador.

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
  const aviso = 'Esto no reserva el salón: la reserva se confirma con el pago de la seña.';

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

/**
 * Avisa al cliente que recibimos su consulta. Nunca rechaza: si el correo falla, la consulta ya
 * está guardada y se registra el error, pero no se le devuelve al cliente. Quien la llama no hace
 * `await` para no frenar la respuesta del cotizador.
 */
export async function avisarConsultaRecibida(
  datos: DatosCorreoConsulta,
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
): Promise<void> {
  try {
    await enviar(correoDeConsulta(datos));
  } catch (error) {
    console.error(
      `No se pudo enviar el correo de la consulta ${datos.presupuesto.id}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
