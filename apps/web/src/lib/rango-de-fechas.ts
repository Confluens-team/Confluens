import { diasDeLaFranja, MAXIMO_DE_DIAS_DE_UN_EVENTO, ultimoDiaPermitido } from '@confluens/shared';

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

// ── Calendario del evento (aside del cotizador) ──────────────────────────────────────────────────
// Los días de un evento tienen que ser seguidos (ADR 0014): desde el calendario se suman días
// estirando la franja hacia atrás o hacia adelante, y se sacan solo de los extremos.

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** `AAAA-MM-DD` corrido `dias` días (negativo, hacia atrás), en UTC para no depender de la zona. */
export function sumarDias(fecha: string, dias: number): string {
  const [anio = 1970, mes = 1, dia = 1] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

export interface CambioDeFranja {
  inicio: string;
  fin: string;
  // Cuántos días se sumaron (positivo) o se sacaron (negativo) ADELANTE del inicio: lo cargado de
  // cada día se corre esa cantidad de posiciones para que siga en su fecha.
  corrimiento: number;
}

/**
 * Tocar un día fuera de la franja la estira hasta él: uno anterior al inicio es el nuevo inicio y uno
 * posterior al fin es el nuevo fin, con los días del medio incluidos. Null si el día ya está en la
 * franja o si la franja pasaría los 32 días.
 */
export function extenderFranja(inicio: string, fin: string, dia: string): CambioDeFranja | null {
  if (dia >= inicio && dia <= fin) return null;
  const nueva = dia < inicio ? { inicio: dia, fin } : { inicio, fin: dia };
  const dias = diasDeLaFranja(nueva.inicio, nueva.fin);
  if (dias === null || dias > MAXIMO_DE_DIAS_DE_UN_EVENTO) return null;
  const corrimiento = dia < inicio ? (diasDeLaFranja(dia, inicio) ?? 1) - 1 : 0;
  return { ...nueva, corrimiento };
}

/**
 * Sacar un día de la franja: solo el primero o el último, y solo si queda al menos uno. Un día del
 * medio no se puede sacar (dejaría un hueco). Null si no se puede.
 */
export function quitarExtremo(inicio: string, fin: string, dia: string): CambioDeFranja | null {
  if (inicio === fin) return null;
  if (dia === inicio) return { inicio: sumarDias(inicio, 1), fin, corrimiento: -1 };
  if (dia === fin) return { inicio, fin: sumarDias(fin, -1), corrimiento: 0 };
  return null;
}

/**
 * Los días que se pueden tocar en el calendario del evento sin pasar los 32 días: desde el que deja
 * la franja en 32 hacia atrás (y nunca antes de `diaMinimo`) hasta el que la deja en 32 hacia
 * adelante.
 */
export function limitesParaExtender(
  inicio: string,
  fin: string,
  diaMinimo?: string,
): { desde: string; hasta: string } {
  const desde = sumarDias(fin, -(MAXIMO_DE_DIAS_DE_UN_EVENTO - 1));
  return {
    desde: diaMinimo && diaMinimo > desde ? diaMinimo : desde,
    hasta: sumarDias(inicio, MAXIMO_DE_DIAS_DE_UN_EVENTO - 1),
  };
}

/**
 * Corre lo cargado de cada día cuando cambia la franja desde el calendario, para que cada día siga
 * en su fecha: con días sumados adelante entran vacíos (`vacio()`), con días sacados adelante se
 * descartan, y el arreglo queda del largo de la franja nueva.
 */
export function correrDias<T>(dias: T[], cambio: CambioDeFranja, vacio: () => T): T[] {
  const corridos =
    cambio.corrimiento >= 0
      ? [...Array.from({ length: cambio.corrimiento }, vacio), ...dias]
      : dias.slice(-cambio.corrimiento);
  const largo = diasDeLaFranja(cambio.inicio, cambio.fin) ?? 1;
  return Array.from({ length: largo }, (_, i) => corridos[i] ?? vacio());
}
