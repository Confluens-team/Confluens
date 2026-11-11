import type { EstadoEvento } from '@confluens/shared';

import { ESTADOS } from './estado-evento';

// «Ver en la agenda» desde la cuenta del evento: abre el calendario en la vista diaria del día del
// evento. Viaja en la URL (/admin/agenda?fecha=AAAA-MM-DD&estado=…) porque la cuenta se muestra
// dentro de cualquier pestaña del panel (agenda, eventos, consultas, clientes) y la agenda es otra.
//
// El estado va también porque la agenda arranca filtrando los que ocupan el salón: sin él, el
// botón de un evento en consulta o cancelado abriría un día donde ese evento no aparece.

export interface DiaEnLaAgenda {
  fecha: string;
  estado: EstadoEvento | null;
}

// `fecha` es la del evento tal como llega de la API (medianoche UTC): el día es la parte
// AAAA-MM-DD, sin pasar por Date, que lo correría al día anterior en Argentina.
export function rutaDelDiaEnLaAgenda(evento: { fecha: string; estado: EstadoEvento }): string {
  const parametros = new URLSearchParams({
    fecha: evento.fecha.slice(0, 10),
    estado: evento.estado,
  });
  return `/admin/agenda?${parametros.toString()}`;
}

// Lo inverso, para la agenda. Una fecha o un estado que no se entienden se ignoran: la agenda abre
// como siempre, en el mes de hoy.
export function leerDiaEnLaAgenda(parametros: URLSearchParams): DiaEnLaAgenda | null {
  const fecha = parametros.get('fecha');
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    return null;
  }
  const estado = parametros.get('estado');
  return { fecha, estado: estado && estado in ESTADOS ? (estado as EstadoEvento) : null };
}
