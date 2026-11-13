import { ErrorApi } from './errores.js';

// HU-50 (ADR 0014): un evento puede durar varios días, pero agendarlo, cobrar su seña, reutilizarlo y
// mover su fecha todavía miran un solo horario por evento. Hasta que la agenda y la comanda sean por
// día (partes 3 y 4) esas acciones se rechazan en vez de dar un resultado equivocado: un falso
// solapamiento, o un día sin mover. El evento de varios días solo se puede cotizar y modificar.

/** El evento dura más de un día: su último día es posterior al primero. */
export function esDeVariosDias(evento: { fecha: Date; fechaFin?: Date | null }): boolean {
  return !!evento.fechaFin && evento.fechaFin.getTime() > evento.fecha.getTime();
}

/** Rechaza (422) la acción si el evento dura más de un día. `accion` va en infinitivo: «agendar». */
export function exigirEventoDeUnDia(
  evento: { fecha: Date; fechaFin?: Date | null },
  accion: string,
): void {
  if (esDeVariosDias(evento)) {
    throw ErrorApi.reglaNegocio(
      `Todavía no se puede ${accion} un evento de varios días: la agenda y la reserva por día ` +
        'llegan en la próxima etapa',
    );
  }
}
