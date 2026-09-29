// Reglas de presentación de importes que comparten el cotizador y el presupuesto del cliente.
// Los importes se guardan sin IVA (RN-05); acá solo se calcula lo que se muestra.

// RN-05: tasa única de IVA. No repetir el 21% en otro lado.
export const TASA_IVA = 0.21;

// RN-08: vigencia del presupuesto desde su emisión (entrevista del 24/09/2026; el PDF decía 30).
export const DIAS_VIGENCIA_PRESUPUESTO = 10;

// RN-01: porcentaje de la seña. Solo se informa: sobre qué base se calcula (con o sin IVA) está
// abierto en pendientes.md (S-08), así que no se muestra un importe de seña.
export const PORCENTAJE_SENA = 20;

export interface Desglose {
  subtotal: number;
  iva: number;
  total: number;
}

const redondear = (importe: number) => Math.round(importe * 100) / 100;

// RN-05: tres renglones. El IVA se calcula sobre el subtotal sin IVA y el total es la suma.
export function desglosarIva(subtotalSinIva: number | string): Desglose {
  const subtotal = redondear(Number(subtotalSinIva));
  const iva = redondear(subtotal * TASA_IVA);
  return { subtotal, iva, total: redondear(subtotal + iva) };
}
