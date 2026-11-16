import { type ChoqueDeSalon, horaDelEvento } from '@confluens/shared';

// La «cinta de días» de un evento de varios días (HU-50, docs/diseno/panel-evento-cinta-de-dias.md):
// una mini-tarjeta por día con su estado, para ver todos los días de un vistazo y editar uno por vez.
// La lógica de cada estado vive acá, sin pantalla, para poder probarla.

/**
 * - `completo`: el día tiene todo lo que necesita.
 * - `conflicto`: algún salón del día lo ocupa otro evento ese día (RN-12, por día y por salón).
 * - `sinCargar`: el día está vacío, típico al extender la franja.
 * - `pendiente`: tiene algo cargado, pero le falta algo (el horario en un evento, un dato en una
 *   consulta).
 */
export type EstadoDelDia = 'completo' | 'conflicto' | 'sinCargar' | 'pendiente';

// Las fechas son de calendario (AAAA-MM-DD): se formatean en UTC para que la zona del navegador no
// corra el día.
const enUtc = (fecha: string) => new Date(`${fecha.slice(0, 10)}T00:00:00Z`);
const formateadorSemanaCorta = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  timeZone: 'UTC',
});
const formateadorLargo = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** «Lun», «Mié»: el día de la semana de la mini-tarjeta. */
export function diaDeSemanaCorto(fecha: string): string {
  const texto = formateadorSemanaCorta.format(enUtc(fecha)).replace('.', '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** El número del día del mes, sin cero adelante. */
export function numeroDelDia(fecha: string): number {
  return Number(fecha.slice(8, 10));
}

/** «Martes 8 de diciembre»: el título del panel del día. */
export function textoDelDia(fecha: string): string {
  const texto = formateadorLargo.format(enUtc(fecha)).replace(',', '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Si el día es lunes: con muchos días, la cinta separa las semanas. */
export function esLunes(fecha: string): boolean {
  return enUtc(fecha).getUTCDay() === 1;
}

/** Los choques de salón agrupados por el día del evento que choca. */
export function choquesPorFecha(choques: ChoqueDeSalon[]): Map<string, ChoqueDeSalon[]> {
  const porFecha = new Map<string, ChoqueDeSalon[]>();
  for (const choque of choques) {
    const fecha = choque.fecha.slice(0, 10);
    porFecha.set(fecha, [...(porFecha.get(fecha) ?? []), choque]);
  }
  return porFecha;
}

/**
 * El estado de un día de un evento (la vista del evento). Primero el conflicto, que impide reservar;
 * después el día vacío; después el que no tiene horario (sin horario no se reserva el salón).
 */
export function estadoDeDiaDeEvento(dia: {
  salones: unknown[];
  lineas: number;
  agendado: boolean;
  conflicto: boolean;
}): EstadoDelDia {
  if (dia.conflicto) return 'conflicto';
  if (dia.salones.length === 0 && dia.lineas === 0) return 'sinCargar';
  if (!dia.agendado || dia.salones.length === 0) return 'pendiente';
  return 'completo';
}

/**
 * El estado de un día de una consulta mientras se edita: vacío si no tiene salones ni servicios,
 * pendiente si todavía no se puede guardar.
 */
export function estadoDeDiaDeConsulta(dia: {
  salones: number;
  lineas: number;
  valido: boolean;
  conflicto: boolean;
}): EstadoDelDia {
  if (dia.conflicto) return 'conflicto';
  if (dia.salones === 0 && dia.lineas === 0) return 'sinCargar';
  if (!dia.valido) return 'pendiente';
  return 'completo';
}

/** «Auditorio + Pucará · 300»: lo que dice la mini-tarjeta debajo del número. */
export function resumenDelDia(salones: string[], personas: number | null): string {
  const lugar = salones.length > 0 ? salones.join(' + ') : 'Sin salón';
  return personas ? `${lugar} · ${personas}` : lugar;
}

/** Un aviso accionable de un día, en la columna de la derecha. */
export interface AvisoDelDia {
  clave: string;
  tono: 'conflicto' | 'sinCargar' | 'pendiente';
  titulo: string;
  texto: string;
  // El día al que lleva «Ver el día».
  indice?: number;
}

// «Jueves 10»: el día en el título de un aviso.
function diaCorto(fecha: string): string {
  return textoDelDia(fecha).split(' de ')[0]!;
}

/**
 * Los avisos de los días (RN-12 y días vacíos): por cada día con un salón ocupado, con qué evento y
 * en qué horario; después, los días sin cargar. Cada uno lleva al día en la cinta.
 */
export function avisosDeLosDias(
  dias: { fecha: string; estado: EstadoDelDia }[],
  choques: Map<string, ChoqueDeSalon[]>,
  // Lo que dice el aviso de un día vacío: en la consulta se puede copiar el anterior.
  textoDiaVacio = 'No tiene salón ni servicios cargados.',
): AvisoDelDia[] {
  const conflictos: AvisoDelDia[] = [];
  const vacios: AvisoDelDia[] = [];
  dias.forEach((dia, indice) => {
    const delDia = choques.get(dia.fecha.slice(0, 10)) ?? [];
    if (delDia.length > 0) {
      conflictos.push({
        clave: `conflicto-${dia.fecha}`,
        tono: 'conflicto',
        titulo: `${diaCorto(dia.fecha)} en conflicto`,
        texto: delDia
          .map(
            ({ salon, evento }) =>
              `El ${salon.nombre} lo tiene el evento #${evento.id} (${evento.cliente})${
                evento.inicio && evento.fin
                  ? ` de ${horaDelEvento(evento.inicio)} a ${horaDelEvento(evento.fin)}`
                  : ''
              }.`,
          )
          .join(' '),
        indice,
      });
    } else if (dia.estado === 'sinCargar') {
      vacios.push({
        clave: `vacio-${dia.fecha}`,
        tono: 'sinCargar',
        titulo: `${diaCorto(dia.fecha)} sin cargar`,
        texto: textoDiaVacio,
        indice,
      });
    }
  });
  return [...conflictos, ...vacios];
}
