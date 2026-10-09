import { z } from 'zod';

// Primitivas comunes a las entidades. Los ids son enteros autoincrementales de PostgreSQL.
export const esquemaId = z.number().int().positive();

// Importe sin IVA (RN-05). Viaja como string (Decimal(12,2) de Prisma) para no perder precisión.
export const esquemaImporte = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Importe inválido');

// Instante en ISO 8601 UTC (2026-10-10T13:00:00.000Z).
export const esquemaFechaHora = z.iso.datetime();

// Fecha de calendario sin hora (2026-10-10). Mensaje en español: como lo usan formularios de cara
// al cliente (HU-14), el error de Zod por defecto ("Invalid ISO date") no sirve para mostrar en la
// UI. Es el mismo mensaje que AGENTS.md usa como ejemplo de VALIDATION_ERROR (campo fechaDeseada),
// así que queda como estándar para cualquier fecha de calendario del sistema.
export const esquemaFecha = z.iso.date('Fecha inválida');

// Para los filtros de los listados: un parámetro presente pero vacío (?cliente=) cuenta como
// ausente. La web manda el querystring armado desde el estado del formulario, así que un campo
// que el usuario borró llega como string vacío y no tiene que fallar la validación.
export const vacioComoAusente = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() === '' ? undefined : valor;

// Zona horaria de los eventos (ADR 0010). Un instante guardado en UTC se lee siempre contra esta
// zona para obtener la hora de reloj: la API la usa para validar la hora de un servicio contra el
// horario del evento y la web para mostrar ese horario, así no pueden contradecirse. No se usa la
// zona del proceso ni la del navegador: en Render el contenedor corre en UTC y daría otra franja.
export const ZONA_HORARIA_EVENTOS = 'America/Argentina/Cordoba';

const FORMATO_HORA_EVENTO = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_HORARIA_EVENTOS,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// "HH:mm" de un instante, en la hora del salón. Mismo formato que Evento.horaInicioEstimada y que
// LineaPresupuesto.horaEstimada, así se pueden comparar como texto.
export function horaDelEvento(instante: Date | string): string {
  return FORMATO_HORA_EVENTO.format(new Date(instante));
}

// "HH:mm" → minutos desde la medianoche, para comparar horas sin pelear con fechas.
export function minutosDeHora(hora: string): number {
  const [h = 0, m = 0] = hora.split(':').map(Number);
  return h * 60 + m;
}
