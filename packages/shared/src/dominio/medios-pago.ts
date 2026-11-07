// Medios de pago (RN-14). Desde HU-53 (reunión con el cliente del 05/11/2026; PO, 06/11/2026) todo
// presupuesto nuevo requiere factura y **todos los medios activos se pueden usar en todos los
// cobros**: ya no hay habilitación por caso. Las columnas `conFactura` y `sinFactura` siguen en la
// base, sin uso. Lo que queda acá es el catálogo inicial y el orden en que se muestran los medios.

/**
 * El catálogo inicial de RN-14, en el orden en que se muestra en el formulario de cobro. Las marcas
 * de factura son las que cargó la migración 20261016211752_medios_de_pago_habilitacion_factura y el
 * seed usa para una base levantada a mano; desde HU-53 ya no deciden nada.
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
