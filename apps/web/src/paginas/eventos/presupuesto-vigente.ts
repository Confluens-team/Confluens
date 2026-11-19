import type { EventoDetallado } from '@confluens/shared';

/**
 * El presupuesto contra el que se cobra un evento: el Confirmado si lo hay, si no el Estimado, y si
 * no el primero. Un evento sin presupuesto devuelve undefined.
 */
export function presupuestoVigenteDe(
  evento: Pick<EventoDetallado, 'presupuestos'>,
): EventoDetallado['presupuestos'][number] | undefined {
  return (
    evento.presupuestos.find((p) => p.estado === 'Confirmado') ??
    evento.presupuestos.find((p) => p.estado === 'Estimado') ??
    evento.presupuestos[0]
  );
}

/**
 * Sin base de cobro contra la que medir nada: o el evento no tiene presupuesto, o tiene el vacío de
 * una consulta social, que se reconoce por venceEn en null (ADR 0008). En los dos casos la cuenta
 * mostraría $0 y cualquier pago lo rechazaría la API por superar el total.
 */
export function sinBaseDeCobro(evento: Pick<EventoDetallado, 'presupuestos'>): boolean {
  const presupuesto = presupuestoVigenteDe(evento);
  return !presupuesto || presupuesto.venceEn === null;
}
