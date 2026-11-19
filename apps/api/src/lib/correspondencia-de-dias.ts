// HU-50: al cambiar la franja de un evento, cada día se identifica por su fecha. Esta es la cuenta que
// decide qué día de antes es cada día de ahora; la comparten el repositorio (que mueve las filas) y el
// servicio (que corre los horarios de un evento reservado), para que no puedan discrepar.

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface CorrespondenciaDeDias {
  // La franja entera se corrió los mismos días (mismo largo y mismo corrimiento): cada día conserva su
  // lugar y pasa a su fecha nueva. Si no, cada día se queda con su fecha y los demás entran o salen.
  corrida: boolean;
  // Para el día nuevo i, el día de antes del que sale (su posición), o null si entra vacío.
  origen: (number | null)[];
  // Cuánto se corrieron, en días (0 si no fue un corrimiento).
  corrimientoEnDias: number;
}

/** `actuales` y `nuevas` son las fechas en milisegundos (medianoche UTC), en orden creciente. */
export function correspondenciaDeDias(actuales: number[], nuevas: number[]): CorrespondenciaDeDias {
  const corrimiento =
    actuales.length === nuevas.length && nuevas.length > 0 ? nuevas[0]! - actuales[0]! : null;
  const corrida =
    corrimiento !== null &&
    corrimiento !== 0 &&
    actuales.every((fecha, i) => nuevas[i]! - fecha === corrimiento);
  if (corrida) {
    return {
      corrida: true,
      origen: nuevas.map((_, i) => i),
      corrimientoEnDias: corrimiento! / MS_POR_DIA,
    };
  }
  const posicion = new Map(actuales.map((fecha, i) => [fecha, i] as const));
  return {
    corrida: false,
    origen: nuevas.map((fecha) => posicion.get(fecha) ?? null),
    corrimientoEnDias: 0,
  };
}
