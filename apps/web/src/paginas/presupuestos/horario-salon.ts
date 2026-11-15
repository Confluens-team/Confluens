import { horaDelEvento, type ConsultaDetallada } from '@confluens/shared';

// Las horas como las escribe Fran en sus presupuestos: «16.00».
const conPunto = (hora: string) => hora.replace(':', '.');

/**
 * El horario que va en la línea del salón del presupuesto formal. Con el evento agendado, el rango
 * real («16.00 a 19.00 hs»); si no, la hora estimada que eligió el cliente («Desde 16.00 hs»), que
 * es solo de referencia (ADR 0007); sin ninguna de las dos, «A confirmar horario».
 */
export function horarioSalon(evento: ConsultaDetallada['evento']): string {
  if (evento.inicio && evento.fin) {
    return `${conPunto(horaDelEvento(evento.inicio))} a ${conPunto(horaDelEvento(evento.fin))} hs`;
  }
  if (evento.horaInicioEstimada && evento.horaFinEstimada) {
    return `Desde ${conPunto(evento.horaInicioEstimada)} hasta ${conPunto(evento.horaFinEstimada)} hs`;
  }
  if (evento.horaInicioEstimada) return `Desde ${conPunto(evento.horaInicioEstimada)} hs`;
  return 'A confirmar horario';
}

/**
 * El horario de UN día de un evento de varios días (HU-50, S-16): el real de ese día si ya está
 * agendado; si no, el que pidió el cliente para ese día en el cotizador; y sin ninguno de los dos,
 * el del evento (`horarioSalon`), como antes.
 */
export function horarioDelDia(
  dia: ConsultaDetallada['dias'][number],
  evento: ConsultaDetallada['evento'],
): string {
  if (dia.inicio && dia.fin) {
    return `${conPunto(horaDelEvento(dia.inicio))} a ${conPunto(horaDelEvento(dia.fin))} hs`;
  }
  if (dia.horaInicioEstimada && dia.horaFinEstimada) {
    return `Desde ${conPunto(dia.horaInicioEstimada)} hasta ${conPunto(dia.horaFinEstimada)} hs`;
  }
  if (dia.horaInicioEstimada) return `Desde ${conPunto(dia.horaInicioEstimada)} hs`;
  return horarioSalon(evento);
}
