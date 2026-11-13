// Franja de días de un evento (HU-50, `backlog.md` y ADR 0014): de 1 a 32 días corridos seguidos,
// contando el de inicio y el de fin. El tope se mide en CANTIDAD DE DÍAS y no en meses del calendario:
// una franja puede empezar a fin de un mes y terminar a fin del siguiente (del 30/04 al 31/05 son 32
// días y se puede; al 01/06 son 33 y no).
//
// Las fechas son strings `AAAA-MM-DD`, sin hora ni zona, y los días se cuentan con aritmética de
// calendario en UTC: así el cambio de mes, el año bisiesto, el cambio de año y los cambios de hora
// no pueden correr la cuenta. La usan la pantalla (para deshabilitar los días que pasarían el tope) y
// la API (que vuelve a validar), y la base la garantiza aparte (`evento_dias_consecutivos`).

export const MAXIMO_DE_DIAS_DE_UN_EVENTO = 32;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// `AAAA-MM-DD` a milisegundos UTC, o null si no es una fecha real (rechaza «2026-02-30»).
function aMilisegundos(fecha: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return null;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const ms = Date.UTC(anio, mes - 1, dia);
  const control = new Date(ms);
  const esReal =
    control.getUTCFullYear() === anio &&
    control.getUTCMonth() === mes - 1 &&
    control.getUTCDate() === dia;
  return esReal ? ms : null;
}

function aFecha(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export type ResultadoDeFranja =
  | { valida: true; dias: number }
  | {
      valida: false;
      motivo: 'fecha-invalida' | 'fin-anterior-al-inicio' | 'supera-el-maximo';
      // La cantidad de días de la franja pedida, cuando se pudo contar.
      dias?: number;
    };

/** Cuántos días tiene la franja, contando el de inicio y el de fin. Null si alguna fecha no es real. */
export function diasDeLaFranja(inicio: string, fin: string): number | null {
  const desde = aMilisegundos(inicio);
  const hasta = aMilisegundos(fin);
  if (desde === null || hasta === null) return null;
  return Math.round((hasta - desde) / MS_POR_DIA) + 1;
}

export function validarFranja(inicio: string, fin: string): ResultadoDeFranja {
  const dias = diasDeLaFranja(inicio, fin);
  if (dias === null) return { valida: false, motivo: 'fecha-invalida' };
  if (dias < 1) return { valida: false, motivo: 'fin-anterior-al-inicio', dias };
  if (dias > MAXIMO_DE_DIAS_DE_UN_EVENTO)
    return { valida: false, motivo: 'supera-el-maximo', dias };
  return { valida: true, dias };
}

/**
 * El último día que se puede elegir como fin de una franja que empieza en `inicio`. El calendario
 * deshabilita los días posteriores apenas se elige el de inicio. Null si `inicio` no es una fecha real.
 */
export function ultimoDiaPermitido(inicio: string): string | null {
  const desde = aMilisegundos(inicio);
  if (desde === null) return null;
  return aFecha(desde + (MAXIMO_DE_DIAS_DE_UN_EVENTO - 1) * MS_POR_DIA);
}

/** Cada fecha de la franja, en orden, o un arreglo vacío si la franja no es válida. */
export function fechasDeLaFranja(inicio: string, fin: string): string[] {
  const resultado = validarFranja(inicio, fin);
  if (!resultado.valida) return [];
  const desde = aMilisegundos(inicio)!;
  return Array.from({ length: resultado.dias }, (_, i) => aFecha(desde + i * MS_POR_DIA));
}

/** El aviso de la pantalla cuando se pide más del máximo. */
export const MENSAJE_FRANJA_MUY_LARGA = `El evento puede durar hasta ${MAXIMO_DE_DIAS_DE_UN_EVENTO} días`;
