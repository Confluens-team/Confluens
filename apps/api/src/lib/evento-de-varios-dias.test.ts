import { describe, expect, it } from 'vitest';

import { esDeVariosDias } from './evento-de-varios-dias.js';

const undia = { fecha: new Date('2040-05-01'), fechaFin: new Date('2040-05-01') };
const tresDias = { fecha: new Date('2040-05-01'), fechaFin: new Date('2040-05-03') };

describe('esDeVariosDias', () => {
  it('es de varios días cuando el último día es posterior al primero', () => {
    expect(esDeVariosDias(tresDias)).toBe(true);
    expect(esDeVariosDias(undia)).toBe(false);
  });

  it('sin fecha de fin (un evento armado a mano en un test) es de un solo día', () => {
    expect(esDeVariosDias({ fecha: new Date('2040-05-01') })).toBe(false);
    expect(esDeVariosDias({ fecha: new Date('2040-05-01'), fechaFin: null })).toBe(false);
  });
});
