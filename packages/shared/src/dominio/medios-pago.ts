// Medios de pago y qué medios se pueden usar en cada cobro (RN-14). Vive en shared porque la regla
// la aplican los dos lados: la web para armar el desplegable del formulario de cobro y la API para
// rechazar un medio que no corresponde.
//
// Desde HU-19 (decisión del PO, 16/10/2026) cada medio guarda en la base si se habilita con
// factura, sin factura o en los dos casos (`conFactura` y `sinFactura`), así que el personal puede
// dar de alta medios nuevos y la regla los alcanza sin tocar código. Lo que queda fijo acá es el
// catálogo inicial: el orden en que se muestra y lo que precarga el seed.

/**
 * El catálogo inicial de RN-14, en el orden en que se muestra en el formulario de cobro, con su
 * habilitación. La migración 20261016211752_medios_de_pago_habilitacion_factura carga estas mismas
 * marcas en la base; el seed las usa para una base levantada a mano.
 */
export const MEDIOS_PAGO_INICIALES = [
  { nombre: 'Efectivo', conFactura: true, sinFactura: true },
  { nombre: 'Transferencia', conFactura: true, sinFactura: true },
  { nombre: 'A la habitación', conFactura: true, sinFactura: true },
  { nombre: 'Débito', conFactura: true, sinFactura: false },
  { nombre: 'Crédito', conFactura: true, sinFactura: false },
  { nombre: 'Cheque', conFactura: true, sinFactura: false },
] as const;

export const MEDIOS_PAGO: readonly string[] = MEDIOS_PAGO_INICIALES.map(({ nombre }) => nombre);

interface HabilitacionMedioPago {
  conFactura: boolean;
  sinFactura: boolean;
}

/**
 * Si un medio se puede usar en un cobro, según la marca de factura del presupuesto
 * (`requiereFactura`, la casilla «El cliente requiere factura»). Que el medio esté activo lo
 * controla quien lo busca: un medio dado de baja no se ofrece ni se acepta.
 */
export function admiteMedioPago(medio: HabilitacionMedioPago, requiereFactura: boolean): boolean {
  return requiereFactura ? medio.conFactura : medio.sinFactura;
}

const alfabetico = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * Orden en que se muestran los medios: primero los del catálogo inicial, en el orden de RN-14 (el
 * que el personal ya conoce), y después los que se dieron de alta, en orden alfabético.
 */
export function compararMediosPago(a: { nombre: string }, b: { nombre: string }): number {
  const posicion = (nombre: string) => {
    const i = MEDIOS_PAGO.indexOf(nombre);
    return i === -1 ? MEDIOS_PAGO.length : i;
  };
  return posicion(a.nombre) - posicion(b.nombre) || alfabetico.compare(a.nombre, b.nombre);
}

/**
 * Los medios que se pueden elegir para un presupuesto, en el orden de `compararMediosPago`. Recibe
 * el catálogo que devuelve la API (los activos) y deja los habilitados para el caso.
 */
export function mediosPagoHabilitados<T extends HabilitacionMedioPago & { nombre: string }>(
  medios: readonly T[],
  requiereFactura: boolean,
): T[] {
  return medios.filter((medio) => admiteMedioPago(medio, requiereFactura)).sort(compararMediosPago);
}
