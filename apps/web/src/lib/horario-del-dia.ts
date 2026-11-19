import { type AgendarEvento, horaDelEvento } from '@confluens/shared';

import { horaDentroDelHorario } from './jornada';

// El horario y la distribución de cada día, cargados en el detalle de la consulta (15/11/2026): antes
// se pedían en el formulario del pago. Al guardar la consulta, si todos los días tienen horario y
// cada salón su distribución, se agenda el evento (POST /eventos/:id/agendar). Agendar no reserva:
// la reserva la hace el pago que llega a la seña (HU-13).

// Argentina no tiene horario de verano: la zona de los eventos (ADR 0010) es siempre UTC−3.
const DESFASE_ZONA_EVENTOS = '-03:00';

// "AAAA-MM-DD" del día siguiente, sin pasar por la zona del navegador.
function diaSiguiente(fecha: string): string {
  const [a = 1970, m = 1, d = 1] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * El instante ISO de una hora de un día del evento, en la zona de los eventos. Una hora más temprana
 * que la de inicio es del día siguiente: el día termina pasada la medianoche.
 */
export function instanteDelDia(fecha: string, hora: string, horaDeInicio: string): string {
  const dia = hora < horaDeInicio ? diaSiguiente(fecha) : fecha;
  return new Date(`${dia}T${hora}:00${DESFASE_ZONA_EVENTOS}`).toISOString();
}

/** La hora "HH:mm" de un instante guardado, o '' si no hay. */
export function horaGuardada(instante: string | null): string {
  return instante ? horaDelEvento(instante) : '';
}

export interface DiaParaAgendar {
  fecha: string;
  inicio: string; // "HH:mm" o ''
  fin: string;
  personas: number;
  // Cada salón del día con la distribución elegida ('' si falta) y la capacidad de esa distribución.
  salones: { salonId: number; distribucionId: string; capacidad: number | null }[];
}

/** Si el día tiene todo para agendarse: las dos horas (distintas) y la distribución de cada salón. */
export function diaListoParaAgendar(dia: DiaParaAgendar): boolean {
  return (
    !!dia.inicio &&
    !!dia.fin &&
    dia.inicio !== dia.fin &&
    dia.salones.length > 0 &&
    dia.salones.every((salon) => salon.distribucionId !== '')
  );
}

/**
 * Lo que le falta a un día para agendarse, en palabras («las dos horas», «la distribución»), o null
 * si está listo. Un día sin salón no se puede agendar: la distribución es del salón.
 */
export function faltaParaAgendar(dia: DiaParaAgendar): string | null {
  const faltas: string[] = [];
  if (!dia.inicio || !dia.fin) faltas.push('las dos horas');
  else if (dia.inicio === dia.fin) faltas.push('una hora de fin distinta de la de inicio');
  if (dia.salones.length === 0) faltas.push('el salón');
  else if (dia.salones.some((salon) => salon.distribucionId === '')) faltas.push('la distribución');
  return faltas.length > 0 ? faltas.join(' y ') : null;
}

/**
 * Lo que le falta a cada día que no se puede agendar («Día 2: la distribución»). Con un solo
 * día no se numera. Vacío si todos están listos.
 */
export function motivosSinAgendar(dias: DiaParaAgendar[]): string[] {
  return dias.flatMap((dia, indice) => {
    const falta = faltaParaAgendar(dia);
    if (!falta) return [];
    return [dias.length > 1 ? `Día ${indice + 1}: ${falta}` : falta];
  });
}

/**
 * Si la hora de un servicio queda fuera del horario del día, extremos incluidos y con la noche que
 * cruza la medianoche. Sin las dos horas del día (o con las dos iguales) no hay contra qué comparar.
 */
export function horaFueraDelHorario(hora: string, inicio: string, fin: string): boolean {
  if (!hora || !inicio || !fin || inicio === fin) return false;
  return !horaDentroDelHorario(hora, inicio, fin);
}

/** Si las personas del día superan lo que admiten sus distribuciones juntas (aviso, no tope). */
export function superaCapacidad(dia: DiaParaAgendar): boolean {
  if (!dia.salones.every((salon) => salon.capacidad !== null)) return false;
  const capacidad = dia.salones.reduce((suma, salon) => suma + (salon.capacidad ?? 0), 0);
  return dia.salones.length > 0 && dia.personas > capacidad;
}

/**
 * El pedido de agendar con el horario y la distribución de todos los días, o null si a algún día le
 * falta algo (agendar es todo o nada). Las personas que superan la capacidad ya se avisan en la
 * pantalla: guardar igual es la confirmación que pide la API (ADR 0011).
 */
export function pedidoDeAgenda(
  dias: DiaParaAgendar[],
  modalidadSalonRestaurante: boolean,
): AgendarEvento | null {
  if (dias.length === 0 || !dias.every(diaListoParaAgendar)) return null;
  return {
    distribuciones: dias.flatMap((dia) =>
      dia.salones.map((salon) => ({
        salonId: salon.salonId,
        distribucionId: Number(salon.distribucionId),
        fecha: dia.fecha,
      })),
    ),
    dias: dias.map((dia) => ({
      fecha: dia.fecha,
      inicio: instanteDelDia(dia.fecha, dia.inicio, dia.inicio),
      fin: instanteDelDia(dia.fecha, dia.fin, dia.inicio),
    })),
    modalidadSalonRestaurante,
    confirmarCapacidadExcedida: dias.some(superaCapacidad),
  };
}
