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
