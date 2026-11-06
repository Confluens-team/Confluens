import { describe, expect, it } from 'vitest';

import { limpiarImporte } from './importe';

describe('limpiarImporte', () => {
  it('deja pasar un importe válido sin tocarlo', () => {
    expect(limpiarImporte('125000')).toBe('125000');
    expect(limpiarImporte('125000.50')).toBe('125000.50');
    expect(limpiarImporte('')).toBe('');
  });

  it('descarta letras, signos y espacios', () => {
    expect(limpiarImporte('12a3')).toBe('123');
    expect(limpiarImporte('$ 1 500')).toBe('1500');
    expect(limpiarImporte('abc')).toBe('');
  });

  it('pasa la coma a punto', () => {
    expect(limpiarImporte('1500,5')).toBe('1500.5');
  });

  it('deja un solo separador decimal', () => {
    expect(limpiarImporte('1.500.25')).toBe('1.50');
    expect(limpiarImporte('10.,5')).toBe('10.5');
  });

  it('corta en dos decimales', () => {
    expect(limpiarImporte('99.999')).toBe('99.99');
  });

  it('conserva el punto recién tipeado, para poder seguir con los decimales', () => {
    expect(limpiarImporte('100.')).toBe('100.');
  });
});
