import { type ChoqueDeSalon, horaDelEvento } from '@confluens/shared';

import { instanteDelDia } from './horario-del-dia';

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

/**
 * Cómo se lleva un choque de salón con el horario que se está cargando ese día:
 * - `pisa`: los horarios se superponen (o el otro evento no tiene horario y no se puede descartar).
 * - `distinto`: es el mismo salón y día, pero a otra hora: no se pisan.
 * - `sinHorario`: el día todavía no tiene las dos horas, así que no se sabe.
 */
export type RelacionDelChoque = 'pisa' | 'distinto' | 'sinHorario';

export type ChoqueConRelacion = ChoqueDeSalon & { relacion: RelacionDelChoque };

/** Lo que el formulario sabe de un día: su horario ("HH:mm" o '') y los salones elegidos. */
export interface DiaParaChoques {
  inicio: string;
  fin: string;
  salonIds: number[];
}

/**
 * El aviso de choques de la API marca todo salón que otro evento tiene ese día, sin mirar la hora y
 * con los salones guardados. Acá se ajusta a lo que se está cargando: se descartan los salones que ya
 * no están elegidos y cada choque queda como se lleva con el horario del día (RN-12 se controla de
 * verdad al agendar; esto es el aviso preventivo).
 */
export function clasificarChoques(
  choques: ChoqueDeSalon[],
  delDia: (fecha: string) => DiaParaChoques | undefined,
): ChoqueConRelacion[] {
  const resultado: ChoqueConRelacion[] = [];
  for (const choque of choques) {
    const fecha = choque.fecha.slice(0, 10);
    const dia = delDia(fecha);
    if (dia && !dia.salonIds.includes(choque.salon.id)) continue;
    resultado.push({ ...choque, relacion: relacionDelChoque(choque, fecha, dia) });
  }
  return resultado;
}

function relacionDelChoque(
  choque: ChoqueDeSalon,
  fecha: string,
  dia: DiaParaChoques | undefined,
): RelacionDelChoque {
  if (!dia || !dia.inicio || !dia.fin || dia.inicio === dia.fin) return 'sinHorario';
  const { inicio: otroInicio, fin: otroFin } = choque.evento;
  if (!otroInicio || !otroFin) return 'pisa';
  const desde = new Date(instanteDelDia(fecha, dia.inicio, dia.inicio));
  const hasta = new Date(instanteDelDia(fecha, dia.fin, dia.inicio));
  return new Date(otroInicio) < hasta && new Date(otroFin) > desde ? 'pisa' : 'distinto';
}

/** Los choques de salón agrupados por el día del evento que choca. */
export function choquesPorFecha<T extends ChoqueDeSalon>(choques: T[]): Map<string, T[]> {
  const porFecha = new Map<string, T[]>();
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
 * Los avisos de los días (RN-12 y días vacíos): por cada día con un salón que tiene otro evento, con
 * qué evento y en qué horario; después, los días sin cargar. Cada uno lleva al día en la cinta.
 * Solo es conflicto si los horarios se superponen; si no se pisan o todavía no hay horario, es un
 * aviso suave que lo explica.
 */
export function avisosDeLosDias(
  dias: { fecha: string; estado: EstadoDelDia }[],
  choques: Map<string, ChoqueConRelacion[]>,
  // Lo que dice el aviso de un día vacío: en la consulta se puede copiar el anterior.
  textoDiaVacio = 'No tiene salón ni servicios cargados.',
): AvisoDelDia[] {
  const conflictos: AvisoDelDia[] = [];
  const otros: AvisoDelDia[] = [];
  const vacios: AvisoDelDia[] = [];
  dias.forEach((dia, indice) => {
    const delDia = choques.get(dia.fecha.slice(0, 10)) ?? [];
    if (delDia.length > 0) {
      const pisa = delDia.some(({ relacion }) => relacion === 'pisa');
      const sinHorario = delDia.some(({ relacion }) => relacion === 'sinHorario');
      const frases = delDia.map(({ salon, evento, relacion }) => {
        const horario =
          evento.inicio && evento.fin
            ? ` de ${horaDelEvento(evento.inicio)} a ${horaDelEvento(evento.fin)}`
            : '';
        const base = `El ${salon.nombre} lo tiene el evento #${evento.id} (${evento.cliente})${horario}`;
        return relacion === 'distinto' ? `${base}: con tu horario no se pisan.` : `${base}.`;
      });
      if (!pisa && sinHorario) {
        frases.push('Cargá el horario del día para saber si se pisan.');
      }
      const aviso: AvisoDelDia = {
        clave: `conflicto-${dia.fecha}`,
        tono: pisa ? 'conflicto' : 'pendiente',
        titulo: pisa
          ? `${diaCorto(dia.fecha)} en conflicto`
          : sinHorario
            ? `${diaCorto(dia.fecha)}: salón con otro evento`
            : `${diaCorto(dia.fecha)}: salón ocupado a otra hora`,
        texto: frases.join(' '),
        indice,
      };
      (pisa ? conflictos : otros).push(aviso);
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
  return [...conflictos, ...otros, ...vacios];
}
