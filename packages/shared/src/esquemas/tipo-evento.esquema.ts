import { z } from 'zod';

// Tipo de evento (ADR 0008). El corporativo pasa por el cotizador; el social llega como consulta
// sin salón ni servicios y el Responsable de Eventos arma el presupuesto.
export const esquemaTipoEvento = z.enum(['Social', 'Corporativo']);
export type TipoEvento = z.infer<typeof esquemaTipoEvento>;

export const esquemaTipoEventoSocial = z.enum(
  ['Cumpleanos', 'Casamiento', 'FiestaDeQuince', 'Bautismo', 'FiestaCorporativa', 'Otro'],
  'Elegí qué tipo de evento social es',
);
export type TipoEventoSocial = z.infer<typeof esquemaTipoEventoSocial>;

// Qué evento es cuando el cliente elige "Otro".
export const esquemaTipoSocialDetalle = z
  .string()
  .trim()
  .min(1, 'Contanos qué evento es')
  .max(120, 'Usá hasta 120 caracteres');

// Media jornada: hasta 4 horas inclusive; completa: más de 4 horas. No se puede derivar de
// Evento.inicio/fin (quedan null mientras el evento está en EnConsulta): la elige el cliente y
// se guarda en Evento.tipoJornada. Definición formal en docs/negocio/tarifario-2026.md.
export const esquemaTipoJornada = z.enum(['completa', 'media']);
export type TipoJornada = z.infer<typeof esquemaTipoJornada>;

// Hora de inicio estimada (HH:mm), opcional y solo de referencia: el horario real se carga al
// agendar el evento (ADR 0007).
export const esquemaHoraEstimada = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida: usá el formato HH:mm');

// "Otro" necesita su detalle (mismo criterio que el CHECK evento_tipo_social de la base).
export function exigirDetalleDeOtro(
  datos: { tipoSocial?: TipoEventoSocial | null; tipoSocialDetalle?: string | null },
  ctx: z.RefinementCtx,
) {
  if (datos.tipoSocial === 'Otro' && !datos.tipoSocialDetalle) {
    ctx.addIssue({
      code: 'custom',
      path: ['tipoSocialDetalle'],
      message: 'Contanos qué evento es',
    });
  }
}
