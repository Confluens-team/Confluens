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

// ── Selector con modo (cotizador del cliente) ────────────────────────────────────────────────────
// El cliente elige primero si su evento dura un día o más de uno. Con «1 día», un clic alcanza; con
// «Más de 1 día», el primer clic es el inicio, al pasar el mouse se pintan los días hasta el puntero
// y el segundo clic es el fin.

export type ModoDeRango = 'uno' | 'varios';

/** El modo con el que se abre el selector: «Más de 1 día» si ya hay una franja elegida. */
export function modoInicial(inicio: string, fin: string): ModoDeRango {
  return inicio && fin && fin !== inicio ? 'varios' : 'uno';
}

/** Lo que pasa al tocar un día según el modo. En «1 día» el evento queda en ese día y se cierra. */
export function elegirDiaEnModo(
  actual: EstadoDeRango,
  dia: string,
  modo: ModoDeRango,
): EstadoDeRango {
  if (modo === 'uno') return { inicio: dia, fin: dia, esperandoFin: false };
  return elegirDia(actual, dia);
}

/**
 * La franja que se pinta mientras el mouse pasa por un día, con el inicio ya elegido y esperando el
 * fin: del inicio al día del puntero. Null si no hay nada que pintar (un día anterior al inicio, el
 * mismo día o uno más allá del tope de 32 días).
 */
export function rangoPrevisualizado(
  estado: EstadoDeRango,
  diaBajoMouse: string | null,
): { inicio: string; fin: string } | null {
  if (!estado.esperandoFin || !estado.inicio || !diaBajoMouse) return null;
  if (diaBajoMouse <= estado.inicio) return null;
  const tope = ultimoDiaPermitido(estado.inicio);
  if (tope !== null && diaBajoMouse > tope) return null;
  return { inicio: estado.inicio, fin: diaBajoMouse };
}
