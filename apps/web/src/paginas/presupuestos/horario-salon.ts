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
  if (evento.horaInicioEstimada) return `Desde ${conPunto(evento.horaInicioEstimada)} hs`;
  return 'A confirmar horario';
}
