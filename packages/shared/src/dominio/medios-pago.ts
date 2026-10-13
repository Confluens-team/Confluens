// Catálogo de medios de pago y qué medios se pueden usar en cada caso. Vive en shared porque la
// regla la aplican los dos lados: la web para armar el desplegable del formulario de cobro y la
// API para rechazar un medio que no corresponde.
//
// El catálogo son nombres y no ids: los ids los asigna la base (tabla `MedioPago`, baja lógica con
// `activo`) y cambian entre entornos. El seed precarga estos mismos nombres.

// Lo que se puede cobrar siempre, se facture o no.
export const MEDIOS_PAGO_SIN_FACTURA = ['Efectivo', 'Transferencia', 'A la habitación'] as const;

// Lo que se puede cobrar cuando el presupuesto SÍ se factura: los de arriba más los que necesitan
// la factura para respaldarse.
export const MEDIOS_PAGO_CON_FACTURA = [
  ...MEDIOS_PAGO_SIN_FACTURA,
  'Débito',
  'Crédito',
  'Cheque',
] as const;

// El catálogo completo, en el orden en que se muestra. Es el que precarga el seed.
export const MEDIOS_PAGO = MEDIOS_PAGO_CON_FACTURA;

/**
 * Los medios habilitados según la marca de factura del presupuesto (`requiereFactura`, la casilla
 * «El cliente requiere factura»): con factura, todo el catálogo; sin factura, solo Efectivo,
 * Transferencia y A la habitación.
 */
export function nombresMediosPagoHabilitados(requiereFactura: boolean): readonly string[] {
  return requiereFactura ? MEDIOS_PAGO_CON_FACTURA : MEDIOS_PAGO_SIN_FACTURA;
}

// Un medio del catálogo que no esté en la lista de arriba (los que quedaron de versiones
// anteriores, como «Tarjeta») no se ofrece ni se acepta: los pagos históricos que lo referencian
// siguen intactos, pero no se cobra más con él.
export function admiteMedioPago(nombre: string, requiereFactura: boolean): boolean {
  return nombresMediosPagoHabilitados(requiereFactura).includes(nombre);
}

/**
 * Filtra el catálogo que devuelve la API dejando solo lo que se puede elegir para este presupuesto,
 * en el orden del catálogo (no el alfabético con el que viene de la base).
 */
export function mediosPagoHabilitados<T extends { nombre: string }>(
  medios: readonly T[],
  requiereFactura: boolean,
): T[] {
  const habilitados = nombresMediosPagoHabilitados(requiereFactura);
  return habilitados
    .map((nombre) => medios.find((medio) => medio.nombre === nombre))
    .filter((medio): medio is T => medio !== undefined);
}
