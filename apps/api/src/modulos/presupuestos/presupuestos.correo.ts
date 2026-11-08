import type { TipoEvento } from '@confluens/shared';

import { type Correo, enviarCorreo } from '../../lib/correo.js';

// Correo de confirmación de la consulta (Sprint 5, PO, 07/11/2026): le avisa al cliente que su
// consulta llegó y repite el mensaje que ya vio en pantalla. No lleva resumen del evento ni PDF: el
// presupuesto estimado se descarga desde el cotizador y el definitivo lo envía el Responsable de
// Eventos. Lo mandan las dos consultas, la corporativa del cotizador y la social (ADR 0008).

export interface DatosCorreoConsulta {
  // Nombre de pila del cliente, para el saludo.
  nombre: string;
  correo: string;
  // El teléfono de la ficha del cliente: es al que lo va a llamar el Responsable de Eventos.
  telefono: string;
  consultaId: number;
  tipo: TipoEvento;
}

// Los colores de la web (index.css): bordó del logo, dorado de los filetes y papel crema.
const BORDO = '#5e1f1a';
const DORADO = '#b08d57';
const DORADO_TEXTO = '#6a4e1c';
const CREMA = '#f6f1ea';

const escapar = (texto: string) =>
  texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// Los mismos textos que ve el cliente al terminar de cargar la consulta (PresupuestoEstimado.tsx y
// ConsultaRecibida.tsx de la web), para que el correo y la pantalla no se contradigan.
function mensajes(tipo: TipoEvento, telefono: string): { saludo: string; detalle: string } {
  if (tipo === 'Social') {
    return {
      saludo: 'recibimos tu consulta.',
      detalle: `Cada evento social es único. Un responsable de eventos se va a comunicar con vos al ${telefono} para elegir juntos el salón, la gastronomía y armar tu presupuesto.`,
    };
  }
  return {
    saludo: 'generamos tu presupuesto estimado.',
    detalle: `Un responsable de eventos va a revisar la disponibilidad del salón y se va a comunicar con vos al ${telefono}.`,
  };
}

export function correoDeConsulta({
  nombre,
  correo,
  telefono,
  consultaId,
  tipo,
}: DatosCorreoConsulta): Correo {
  const { saludo, detalle } = mensajes(tipo, telefono);
  const asunto = `Recibimos tu consulta N° ${consultaId} en Los Abuelos`;
  const texto = [
    'LOS ABUELOS',
    '',
    `Hola ${nombre}, ${saludo}`,
    '',
    detalle,
    '',
    `Número de consulta: ${consultaId}`,
    '',
    'Los Abuelos Servicios Gastronómicos',
  ].join('\n');

  // Maquetado con tablas y estilos en línea: es lo que soportan los clientes de correo. El sello es
  // texto y no una imagen, porque las imágenes remotas se bloquean por defecto y dependerían de una
  // URL pública de la web.
  const html =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREMA};padding:24px 0;">` +
    '<tr><td align="center">' +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${DORADO};font-family:Georgia,'Times New Roman',serif;color:#2b2b2b;">` +
    `<tr><td align="center" style="background:${BORDO};padding:24px 16px;">` +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    `<td align="center" width="44" height="44" style="width:44px;height:44px;border-radius:22px;background:${CREMA};color:${BORDO};font-size:18px;font-weight:bold;border:1px solid ${DORADO};">LA</td>` +
    `<td style="padding-left:12px;color:${CREMA};font-size:20px;letter-spacing:3px;">LOS ABUELOS</td>` +
    '</tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 32px;font-size:16px;line-height:1.6;">' +
    `<p style="margin:0 0 16px;">Hola ${escapar(nombre)}, ${saludo}</p>` +
    `<p style="margin:0 0 16px;">${escapar(detalle)}</p>` +
    `<p style="margin:0;color:${DORADO_TEXTO};font-size:14px;">Número de consulta: <strong>${consultaId}</strong></p>` +
    '</td></tr>' +
    `<tr><td align="center" style="border-top:1px solid ${DORADO};padding:16px;font-size:12px;letter-spacing:1px;color:${DORADO_TEXTO};">Los Abuelos Servicios Gastronómicos</td></tr>` +
    '</table>' +
    '</td></tr></table>';
  return { para: correo, asunto, texto, html };
}

/**
 * Avisa al cliente que recibimos su consulta. Nunca rechaza: si el armado o el envío fallan, la
 * consulta ya está guardada, así que se registra el error y no se le devuelve al cliente. Quien la
 * llama no hace `await` para no frenar la respuesta.
 */
export async function avisarConsultaRecibida(
  datos: DatosCorreoConsulta,
  enviar: (correo: Correo) => Promise<void> = enviarCorreo,
): Promise<void> {
  try {
    await enviar(correoDeConsulta(datos));
  } catch (error) {
    console.error(
      `No se pudo enviar el correo de la consulta ${datos.consultaId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
