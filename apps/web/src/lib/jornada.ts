import type { TipoJornada } from '@confluens/shared';

// Media jornada: hasta 4 horas inclusive; completa: más de 4 (dominio.md).
const MINUTOS_MEDIA_JORNADA = 4 * 60;
const MINUTOS_POR_DIA = 24 * 60;

const aMinutos = (hora: string) => {
  const [h = 0, m = 0] = hora.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Cuánto dura un evento entre dos horas "HH:mm". Una hora de fin menor que la de inicio es del día
 * siguiente (el evento cruza la medianoche, decisión del PO del 07/11/2026). Dos horas iguales
 * se toman como un día entero: no es un horario válido y el formulario no deja enviarlo.
 */
export function duracionEnMinutos(inicio: string, fin: string): number {
  const diferencia = aMinutos(fin) - aMinutos(inicio);
  return diferencia > 0 ? diferencia : diferencia + MINUTOS_POR_DIA;
}

/**
 * La jornada que le corresponde a un horario. En un evento social no cambia ningún precio, pero la
 * consulta la guarda igual: sin las dos horas queda en jornada completa, como antes.
 */
export function jornadaDeHoras(inicio: string, fin: string): TipoJornada {
  if (!inicio || !fin) return 'completa';
  return duracionEnMinutos(inicio, fin) <= MINUTOS_MEDIA_JORNADA ? 'media' : 'completa';
}

/** El horario que dejó el cliente en la consulta de un evento social, como se muestra. */
export function textoHorarioEstimado(inicio?: string | null, fin?: string | null): string {
  if (inicio && fin) return `${inicio} a ${fin} h`;
  if (inicio) return `Desde ${inicio} h`;
  return 'A definir';
}
