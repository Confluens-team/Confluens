import { type AgendarEvento, horaDelEvento } from '@confluens/shared';

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
