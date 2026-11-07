import { describe, expect, it } from 'vitest';

import { esquemaCrearMedioPago } from '../esquemas/pago.esquema.js';
import { compararMediosPago } from './medios-pago.js';

describe('compararMediosPago', () => {
  // CP-19-03: un medio dado de alta aparece en el desplegable, después de los del catálogo inicial.
  it('muestra primero el catálogo inicial, en su orden, y después los medios nuevos', () => {
    const catalogo = [
      { nombre: 'A la habitación' },
      { nombre: 'Cheque' },
      { nombre: 'Mercado Pago' },
      { nombre: 'Efectivo' },
      { nombre: 'Débito' },
    ];
    expect([...catalogo].sort(compararMediosPago).map((m) => m.nombre)).toEqual([
      'Efectivo',
      'A la habitación',
      'Débito',
      'Cheque',
      'Mercado Pago',
    ]);
  });

  it('ordena alfabéticamente los medios que no son del catálogo inicial', () => {
    const nuevos = [{ nombre: 'Vale' }, { nombre: 'cuenta corriente' }, { nombre: 'Efectivo' }];
    expect([...nuevos].sort(compararMediosPago).map((m) => m.nombre)).toEqual([
      'Efectivo',
      'cuenta corriente',
      'Vale',
    ]);
  });
});

describe('esquemaCrearMedioPago (HU-19, HU-53)', () => {
  // Desde HU-53 el alta pide solo el nombre: todos los medios valen en todos los cobros.
  it('recorta el nombre y no pide en qué cobros se usa', () => {
    expect(esquemaCrearMedioPago.parse({ nombre: '  Mercado Pago ' })).toEqual({
      nombre: 'Mercado Pago',
    });
  });

  // CP-19-04.
  it('rechaza un nombre vacío o solo con espacios', () => {
    expect(esquemaCrearMedioPago.safeParse({ nombre: '   ' }).success).toBe(false);
  });
});
