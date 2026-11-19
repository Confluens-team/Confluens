// HU-50 (ADR 0014): un evento puede durar varios días. Casi todo se resuelve día por día (horario,
// solapamiento, comanda); estas ayudas son para los pocos lugares que solo necesitan saber si lo dura.

/** El evento dura más de un día: su último día es posterior al primero. */
export function esDeVariosDias(evento: { fecha: Date; fechaFin?: Date | null }): boolean {
  return !!evento.fechaFin && evento.fechaFin.getTime() > evento.fecha.getTime();
}
