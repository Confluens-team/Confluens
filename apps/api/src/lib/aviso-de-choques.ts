import { type ChoqueDeSalon, horaDelEvento } from '@confluens/shared';

import type { DetalleError } from '@confluens/shared';

// El rechazo de un evento de varios días con un salón ocupado (RN-12, HU-50, `backlog.md`, «Aviso de
// solapamientos»): lista TODOS los choques, cada uno con el día, el salón, el evento con el que choca y
// su horario, y dice cuántos días están libres, para que el Responsable de Eventos hable con el cliente
// y cambie el día, el horario o el salón. «Muy bien y muy claro» (PO, 12/11/2026).

const formateadorDia = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

// «jueves 14/05/2027»: la fecha es de calendario (AAAA-MM-DD), sin hora ni zona.
export function textoDelDia(fecha: string): string {
  return formateadorDia.format(new Date(`${fecha}T00:00:00Z`)).replace(',', '');
}

function textoDelChoque(choque: ChoqueDeSalon): string {
  const { evento, salon } = choque;
  const horario =
    evento.inicio && evento.fin
      ? `, de ${horaDelEvento(evento.inicio)} a ${horaDelEvento(evento.fin)}`
      : '';
  return `Salón ${salon.nombre}: reservado por el evento #${evento.id} (${evento.cliente})${horario}.`;
}

/**
 * El mensaje completo y su detalle: una línea por choque, con la fecha como `campo`.
 * `accion` va en infinitivo: «reservar», «agendar».
 */
export function avisoDeChoques(
  choques: ChoqueDeSalon[],
  totalDeDias: number,
  accion: string,
): { mensaje: string; detalles: DetalleError[] } {
  const diasConChoque = new Set(choques.map((choque) => choque.fecha)).size;
  const libres = totalDeDias - diasConChoque;
  const encabezado =
    `No se puede ${accion} el evento: ${diasConChoque} de sus ${totalDeDias} días ` +
    `${diasConChoque === 1 ? 'tiene' : 'tienen'} un salón ocupado.`;
  const lista = choques.map(
    (choque) => `- ${textoDelDia(choque.fecha)} · ${textoDelChoque(choque)}`,
  );
  const pie =
    (libres === 0
      ? ''
      : libres === 1
        ? 'El otro día está libre. '
        : `Los otros ${libres} días están libres. `) +
    'Hablá con el cliente para mover el día, el horario o el salón.';
  return {
    mensaje: [encabezado, ...lista, '', pie].join('\n'),
    detalles: choques.map((choque) => ({
      campo: choque.fecha,
      mensaje: `${textoDelDia(choque.fecha)} · ${textoDelChoque(choque)}`,
    })),
  };
}
