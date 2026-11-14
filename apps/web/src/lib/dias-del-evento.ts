import { horaDelEvento, type TipoJornada } from '@confluens/shared';

// Cómo se muestra lo que cambia de un día a otro en un evento de varios días (HU-50, `backlog.md`,
// «Resumen del evento en pantalla»): donde hoy hay una sola cantidad de personas y una sola jornada,
// un evento de varios días muestra el rango y, si la jornada varía, lo dice. El detalle día por día
// se ve al entrar al evento.

/** «60 personas» si todos los días son iguales; «50 a 120 personas» si varían. */
export function textoDePersonas(cantidades: number[]): string {
  if (cantidades.length === 0) return '';
  const menor = Math.min(...cantidades);
  const mayor = Math.max(...cantidades);
  return menor === mayor ? `${mayor} personas` : `${menor} a ${mayor} personas`;
}

const NOMBRE_JORNADA: Record<TipoJornada, string> = {
  completa: 'Jornada completa',
  media: 'Media jornada',
};

/**
 * La jornada de todo el evento: si todos los días tienen la misma, cuál es; si varían, «Varía» y
 * se aclara cuáles («media y completa», en el orden en que aparecen).
 */
export function resumenDeJornada(jornadas: TipoJornada[]): { texto: string; varia: boolean } {
  const distintas = [...new Set(jornadas)];
  if (distintas.length === 0) return { texto: '', varia: false };
  if (distintas.length === 1) return { texto: NOMBRE_JORNADA[distintas[0]!], varia: false };
  const nombres = distintas.map((jornada) => (jornada === 'media' ? 'media' : 'completa'));
  return { texto: `Varía (${nombres.join(' y ')})`, varia: true };
}

export function nombreDeJornada(jornada: TipoJornada): string {
  return NOMBRE_JORNADA[jornada];
}

/**
 * Lo que se muestra de un evento en una tarjeta o un renglón (HU-50): sus personas y su jornada
 * resumidas, y cuánto dura. Un evento de un solo día se lee como siempre; uno de varios muestra el
 * rango de personas y, si la jornada cambia de un día a otro, «Varía».
 */
export function resumenDelEvento(evento: {
  cantidadPersonas: number;
  tipoJornada: TipoJornada | null;
  dias?: { cantidadPersonas: number; tipoJornada: TipoJornada | null }[];
}): { personas: string; jornada: string | null; dias: number } {
  const dias = evento.dias ?? [];
  if (dias.length <= 1) {
    return {
      personas: `${evento.cantidadPersonas} personas`,
      jornada: evento.tipoJornada ? NOMBRE_JORNADA[evento.tipoJornada] : null,
      dias: 1,
    };
  }
  const jornadas = dias.flatMap((dia) => (dia.tipoJornada ? [dia.tipoJornada] : []));
  return {
    personas: textoDePersonas(dias.map((dia) => dia.cantidadPersonas)),
    jornada: jornadas.length > 0 ? resumenDeJornada(jornadas).texto : null,
    dias: dias.length,
  };
}

/**
 * El horario de un evento de varios días en una línea: si todos los días empiezan y terminan a la
 * misma hora, esa hora («09:00 a 18:00, todos los días»); si no, «el horario varía según el día».
 * Sin horario agendado en algún día, null.
 */
export function horarioDeLosDias(
  dias: { inicio: string | null; fin: string | null }[],
): string | null {
  if (dias.length === 0 || dias.some((dia) => !dia.inicio || !dia.fin)) return null;
  const franjas = new Set(
    dias.map((dia) => `${horaDelEvento(dia.inicio!)} a ${horaDelEvento(dia.fin!)}`),
  );
  return franjas.size === 1
    ? `${[...franjas][0]}, todos los días`
    : 'El horario varía según el día';
}

/**
 * Las líneas de un presupuesto repartidas por día, en el orden en que aparece cada día. Una línea
 * sin día (un presupuesto armado a mano en un test, o uno anterior a HU-50 que todavía no la trae)
 * queda en el primero.
 */
export function agruparPorDia<T extends { diaId?: number }>(
  lineas: T[],
): { diaId: number | undefined; lineas: T[] }[] {
  const grupos = new Map<number | undefined, T[]>();
  for (const linea of lineas) {
    const grupo = grupos.get(linea.diaId) ?? [];
    grupo.push(linea);
    grupos.set(linea.diaId, grupo);
  }
  return [...grupos].map(([diaId, delDia]) => ({ diaId, lineas: delDia }));
}
