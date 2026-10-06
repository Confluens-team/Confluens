// Constantes de las reglas de negocio sobre importes. Vive en shared porque las usan los dos lados:
// la web para mostrar el desglose y la API para calcular la base de cobro de RN-01.
// Los importes se guardan sin IVA (RN-05); lo que se muestra se calcula.

// RN-05: tasa única de IVA, expresada como porcentaje entero y no como 0.21.
// La web hace la cuenta con `number` y la API con `Prisma.Decimal`: 21 es exacto en los dos mundos,
// 0.21 no lo es en punto flotante. No repetir el 21% en otro lado.
export const PORCENTAJE_IVA = 21;

// RN-08: vigencia del presupuesto desde su emisión (entrevista del 24/09/2026; el PDF decía 30).
export const DIAS_VIGENCIA_PRESUPUESTO = 10;

// RN-01: porcentaje de la base de cobro que hay que pagar para que el salón quede reservado.
// La base es el total CON IVA si el presupuesto tiene requiereFactura, y el subtotal sin IVA si no
// (resolución de S-08). La cuenta no se comparte como función: en la API se hace con Prisma.Decimal
// y nunca con `number`. Se comparte la constante, no la aritmética.
export const PORCENTAJE_SENA = 20;

export interface Desglose {
  subtotal: number;
  iva: number;
  total: number;
}

const redondear = (importe: number) => Math.round(importe * 100) / 100;

// RN-05: tres renglones. El IVA se calcula sobre el subtotal sin IVA y el total es la suma.
// Cálculo de presentación: trabaja con `number` y solo se usa en la web.
export function desglosarIva(subtotalSinIva: number | string): Desglose {
  const subtotal = redondear(Number(subtotalSinIva));
  const iva = redondear((subtotal * PORCENTAJE_IVA) / 100);
  return { subtotal, iva, total: redondear(subtotal + iva) };
}
