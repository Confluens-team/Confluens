import { diasDeLaFranja, ultimoDiaPermitido } from '@confluens/shared';

// Elegir la franja de días de un evento (HU-50, `backlog.md`): un clic elige el día de inicio y, si no
// hay un segundo, el evento dura un solo día; un segundo clic elige el día de fin y el calendario
// conecta los dos. La lógica de los clics vive acá, sin pantalla, para poder probarla.

export interface EstadoDeRango {
  inicio: string; // 'AAAA-MM-DD', '' si todavía no se eligió nada
  fin: string; // igual que `inicio` mientras no hay un segundo clic: un solo día
  // Se hizo el primer clic y falta el segundo. Reabrir el selector empieza de cero (false).
  esperandoFin: boolean;
}

export function estadoInicialDeRango(inicio: string, fin: string): EstadoDeRango {
  return { inicio, fin: fin || inicio, esperandoFin: false };
}

/**
 * Lo que pasa al tocar un día del calendario.
 * - Sin primer clic hecho (o con la franja ya completa): el día es el nuevo inicio y, por ahora, el
 *   evento dura ese solo día. Es el «tercer clic empieza una elección nueva».
 * - Con el inicio elegido: el mismo día lo deja en un solo día, uno posterior es el fin y uno
 *   anterior pasa a ser el nuevo inicio.
 * Un día más allá del tope de 32 días no se puede elegir como fin (la pantalla lo deshabilita); si
 * llegara igual, se toma como un inicio nuevo en vez de armar una franja inválida.
 */
export function elegirDia(actual: EstadoDeRango, dia: string): EstadoDeRango {
  const nuevoInicio = { inicio: dia, fin: dia, esperandoFin: true };
  if (!actual.esperandoFin || !actual.inicio) return nuevoInicio;
  if (dia < actual.inicio) return nuevoInicio;
  const tope = ultimoDiaPermitido(actual.inicio);
  if (tope !== null && dia > tope) return nuevoInicio;
  return { inicio: actual.inicio, fin: dia, esperandoFin: false };
}

/**
 * El último día que se puede tocar mientras se elige el fin: el que deja la franja en 32 días. Fuera
 * de esa elección no hay tope (todo día es un inicio posible).
 */
export function diaMaximoParaElegir(estado: EstadoDeRango): string | undefined {
  if (!estado.esperandoFin || !estado.inicio) return undefined;
  return ultimoDiaPermitido(estado.inicio) ?? undefined;
}

/** «1 día», «5 días», para mostrar al lado de la franja. */
export function textoDeDias(inicio: string, fin: string): string {
  const dias = diasDeLaFranja(inicio, fin || inicio) ?? 1;
  return dias === 1 ? '1 día' : `${dias} días`;
}
