import { ZONA_HORARIA_EVENTOS } from '../esquemas/comunes.esquema.js';

// Precios de RN-11 (recargo por modalidad) y RN-13 (proyección a la fecha del evento). A diferencia
// de la seña (importes.ts), acá sí se comparte la aritmética: el cotizador y el editor del
// presupuesto muestran el precio antes de guardarlo, y la API tiene que llegar exactamente al mismo
// número (modelo-datos.md, «Precios congelados y proyectados»). Para que sea exacto en `number`, la
// cuenta se hace en centavos enteros y se redondea en cada paso; entra y sale como string con dos
// decimales, igual que esquemaImporte.

export const MODALIDADES_SERVICIO = ['Normal', 'Continuo', 'EnMesa'] as const;
export type ModalidadServicio = (typeof MODALIDADES_SERVICIO)[number];

// RN-11: porcentaje entero sobre el precio base por persona, sin IVA.
export const RECARGO_MODALIDAD: Record<ModalidadServicio, number> = {
  Normal: 0,
  Continuo: 20,
  EnMesa: 30,
};

export const NOMBRE_MODALIDAD: Record<ModalidadServicio, string> = {
  Normal: 'Normal',
  Continuo: 'Continuo en salón',
  EnMesa: 'En mesas con mozo',
};

const aCentavos = (importe: number | string) => Math.round(Number(importe) * 100);
const deCentavos = (centavos: number) => (centavos / 100).toFixed(2);

// RN-11: el precio unitario de la línea es el base con el recargo de la modalidad.
export function aplicarModalidad(
  precioBase: number | string,
  modalidad: ModalidadServicio,
): string {
  return deCentavos(
    Math.round((aCentavos(precioBase) * (100 + RECARGO_MODALIDAD[modalidad])) / 100),
  );
}

// Meses calendario entre el mes de `hoy` y el del evento, los dos como YYYY-MM-DD. El incremento se
// aplica el primer día de cada mes (S-10), así que un evento en el mes en curso, o en uno pasado,
// no se proyecta.
export function mesesHastaEvento(hoy: string, fechaEvento: string): number {
  const [anioHoy = 0, mesHoy = 0] = hoy.split('-').map(Number);
  const [anioEvento = 0, mesEvento = 0] = fechaEvento.split('-').map(Number);
  return Math.max(0, (anioEvento - anioHoy) * 12 + (mesEvento - mesHoy));
}

// RN-13: precio_actual × (1 + p)^meses, compuesto. Se redondea al centavo una vez por mes, como si
// el aumento se hubiera aplicado al tarifario cada día 1.
export function proyectarPrecio(
  precio: number | string,
  porcentajeMensual: number | string,
  meses: number,
): string {
  const puntosBasicos = Math.round(Number(porcentajeMensual) * 100);
  let centavos = aCentavos(precio);
  for (let mes = 0; mes < meses; mes++) {
    centavos = Math.round((centavos * (10000 + puntosBasicos)) / 10000);
  }
  return deCentavos(centavos);
}

const FORMATO_FECHA_EVENTO = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA_EVENTOS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// La fecha de hoy (YYYY-MM-DD) en la zona de los eventos (ADR 0010), no la del proceso ni la del
// navegador: en Render el contenedor corre en UTC y a las 22 h de Córdoba ya sería mañana.
export function hoyEnZonaEventos(ahora: Date = new Date()): string {
  return FORMATO_FECHA_EVENTO.format(ahora);
}
