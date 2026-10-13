import type { TipoEvento, TipoEventoSocial } from '../esquemas/tipo-evento.esquema.js';

// Etiquetas para pantalla del tipo de evento (ADR 0008).
export const ETIQUETAS_TIPO_EVENTO: Record<TipoEvento, string> = {
  Corporativo: 'Corporativo',
  Social: 'Social',
};

// En el orden en que se ofrecen al cliente.
export const ETIQUETAS_TIPO_EVENTO_SOCIAL: Record<TipoEventoSocial, string> = {
  Cumpleanos: 'Cumpleaños',
  Casamiento: 'Casamiento',
  FiestaDeQuince: 'Fiesta de 15',
  Bautismo: 'Bautismo',
  FiestaCorporativa: 'Fiesta corporativa',
  Otro: 'Otro',
};

// "Corporativo", "Social · Casamiento" o "Social · Despedida de soltera" (el detalle de "Otro").
export function etiquetaTipoEvento(evento: {
  tipo: TipoEvento;
  tipoSocial?: TipoEventoSocial | null;
  tipoSocialDetalle?: string | null;
}): string {
  if (evento.tipo === 'Corporativo' || !evento.tipoSocial)
    return ETIQUETAS_TIPO_EVENTO[evento.tipo];
  const detalle =
    evento.tipoSocial === 'Otro' && evento.tipoSocialDetalle
      ? evento.tipoSocialDetalle
      : ETIQUETAS_TIPO_EVENTO_SOCIAL[evento.tipoSocial];
  return `Social · ${detalle}`;
}
