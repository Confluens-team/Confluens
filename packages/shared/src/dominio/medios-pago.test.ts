import { describe, expect, it } from 'vitest';

import {
  admiteMedioPago,
  mediosPagoHabilitados,
  MEDIOS_PAGO_CON_FACTURA,
  MEDIOS_PAGO_SIN_FACTURA,
} from './medios-pago.js';

// El catálogo tal cual lo devuelve la API: activos y ordenados alfabéticamente, más un medio viejo
// que quedó en la base de una versión anterior.
const catalogo = [
  { id: 4, nombre: 'Cheque' },
  { id: 3, nombre: 'Crédito' },
  { id: 2, nombre: 'Débito' },
  { id: 1, nombre: 'Efectivo' },
  { id: 6, nombre: 'Tarjeta' },
  { id: 5, nombre: 'Transferencia' },
];

describe('admiteMedioPago', () => {
  it('sin factura solo admite Efectivo y Transferencia', () => {
    expect(admiteMedioPago('Efectivo', false)).toBe(true);
    expect(admiteMedioPago('Transferencia', false)).toBe(true);
    expect(admiteMedioPago('Débito', false)).toBe(false);
    expect(admiteMedioPago('Crédito', false)).toBe(false);
    expect(admiteMedioPago('Cheque', false)).toBe(false);
  });

  it('con factura admite los cinco medios del catálogo', () => {
    for (const nombre of MEDIOS_PAGO_CON_FACTURA) {
      expect(admiteMedioPago(nombre, true)).toBe(true);
    }
  });

  it('nunca admite un medio que no está en el catálogo', () => {
    expect(admiteMedioPago('Tarjeta', true)).toBe(false);
    expect(admiteMedioPago('A la habitación', false)).toBe(false);
  });
});

describe('mediosPagoHabilitados', () => {
  it('sin factura deja solo los dos medios habilitados', () => {
    expect(mediosPagoHabilitados(catalogo, false).map((medio) => medio.nombre)).toEqual([
      ...MEDIOS_PAGO_SIN_FACTURA,
    ]);
  });

  it('con factura devuelve los cinco en el orden del catálogo, no en el alfabético', () => {
    expect(mediosPagoHabilitados(catalogo, true).map((medio) => medio.nombre)).toEqual([
      ...MEDIOS_PAGO_CON_FACTURA,
    ]);
  });

  it('omite los medios que la base todavía no tiene cargados', () => {
    const parcial = [{ id: 1, nombre: 'Efectivo' }];
    expect(mediosPagoHabilitados(parcial, true)).toEqual([{ id: 1, nombre: 'Efectivo' }]);
  });
});
