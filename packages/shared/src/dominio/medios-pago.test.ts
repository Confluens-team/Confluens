import { describe, expect, it } from 'vitest';

import { esquemaCrearMedioPago } from '../esquemas/pago.esquema.js';
import {
  admiteMedioPago,
  compararMediosPago,
  mediosPagoHabilitados,
  MEDIOS_PAGO_INICIALES,
} from './medios-pago.js';

// El catálogo tal cual lo devuelve la API: los activos, ordenados alfabéticamente, con su
// habilitación. «Mercado Pago» es un medio dado de alta después (HU-19), solo con factura.
const catalogo = [
  { id: 7, nombre: 'A la habitación', conFactura: true, sinFactura: true },
  { id: 4, nombre: 'Cheque', conFactura: true, sinFactura: false },
  { id: 3, nombre: 'Crédito', conFactura: true, sinFactura: false },
  { id: 2, nombre: 'Débito', conFactura: true, sinFactura: false },
  { id: 1, nombre: 'Efectivo', conFactura: true, sinFactura: true },
  { id: 8, nombre: 'Mercado Pago', conFactura: true, sinFactura: false },
  { id: 5, nombre: 'Transferencia', conFactura: true, sinFactura: true },
];

describe('admiteMedioPago (RN-14)', () => {
  it('sin factura admite solo los medios habilitados sin factura', () => {
    expect(admiteMedioPago({ conFactura: true, sinFactura: true }, false)).toBe(true);
    expect(admiteMedioPago({ conFactura: true, sinFactura: false }, false)).toBe(false);
  });

  it('con factura admite solo los medios habilitados con factura', () => {
    expect(admiteMedioPago({ conFactura: true, sinFactura: false }, true)).toBe(true);
    expect(admiteMedioPago({ conFactura: false, sinFactura: true }, true)).toBe(false);
  });

  it('un medio sin habilitar (como «Tarjeta», dada de baja) no se admite en ningún caso', () => {
    expect(admiteMedioPago({ conFactura: false, sinFactura: false }, true)).toBe(false);
    expect(admiteMedioPago({ conFactura: false, sinFactura: false }, false)).toBe(false);
  });

  it('el catálogo inicial conserva la habilitación de RN-14', () => {
    const sinFactura = MEDIOS_PAGO_INICIALES.filter((m) => admiteMedioPago(m, false));
    const conFactura = MEDIOS_PAGO_INICIALES.filter((m) => admiteMedioPago(m, true));
    expect(sinFactura.map((m) => m.nombre)).toEqual([
      'Efectivo',
      'Transferencia',
      'A la habitación',
    ]);
    expect(conFactura).toHaveLength(6);
  });
});

describe('mediosPagoHabilitados', () => {
  it('sin factura deja solo los habilitados, en el orden del catálogo', () => {
    expect(mediosPagoHabilitados(catalogo, false).map((medio) => medio.nombre)).toEqual([
      'Efectivo',
      'Transferencia',
      'A la habitación',
    ]);
  });

  // CP-19-03: un medio dado de alta aparece en el desplegable, después de los del catálogo inicial.
  it('con factura muestra primero el catálogo inicial y después los medios nuevos', () => {
    expect(mediosPagoHabilitados(catalogo, true).map((medio) => medio.nombre)).toEqual([
      'Efectivo',
      'Transferencia',
      'A la habitación',
      'Débito',
      'Crédito',
      'Cheque',
      'Mercado Pago',
    ]);
  });
});

describe('compararMediosPago', () => {
  it('ordena alfabéticamente los medios que no son del catálogo inicial', () => {
    const nuevos = [{ nombre: 'Vale' }, { nombre: 'cuenta corriente' }, { nombre: 'Efectivo' }];
    expect([...nuevos].sort(compararMediosPago).map((m) => m.nombre)).toEqual([
      'Efectivo',
      'cuenta corriente',
      'Vale',
    ]);
  });
});

describe('esquemaCrearMedioPago (HU-19)', () => {
  it('recorta el nombre y acepta un medio habilitado en al menos un caso', () => {
    expect(esquemaCrearMedioPago.parse({ nombre: '  Mercado Pago ', conFactura: true })).toEqual({
      nombre: 'Mercado Pago',
      conFactura: true,
      sinFactura: false,
    });
  });

  // CP-19-04 y CP-19-08.
  it('rechaza un nombre vacío o solo con espacios, y un medio sin habilitar en ningún caso', () => {
    expect(esquemaCrearMedioPago.safeParse({ nombre: '   ', sinFactura: true }).success).toBe(
      false,
    );
    const sinCasos = esquemaCrearMedioPago.safeParse({ nombre: 'Vale' });
    expect(sinCasos.success).toBe(false);
    expect(sinCasos.error?.issues[0]?.path).toEqual(['conFactura']);
  });
});
