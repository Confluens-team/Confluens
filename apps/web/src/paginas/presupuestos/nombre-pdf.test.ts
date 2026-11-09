import { describe, expect, it } from 'vitest';

import { nombrePdfPresupuesto } from './nombre-pdf';

describe('nombrePdfPresupuesto', () => {
  it('lleva la fecha del evento y el apellido', () => {
    expect(nombrePdfPresupuesto('2026-11-20', { nombre: 'Juan', apellido: 'Perez' })).toBe(
      'presupuesto-2026-11-20-perez',
    );
  });

  it('saca las tildes y une con guiones un apellido de varias palabras', () => {
    expect(nombrePdfPresupuesto('2026-11-20', { nombre: 'Ana', apellido: 'De la Peña' })).toBe(
      'presupuesto-2026-11-20-de-la-pena',
    );
  });

  it('sin apellido usa el nombre, que es la razón social', () => {
    expect(
      nombrePdfPresupuesto('2026-12-01', { nombre: 'Acme & Hijos S.A.', apellido: null }),
    ).toBe('presupuesto-2026-12-01-acme-hijos-s-a');
  });

  it('un apellido en blanco cuenta como que no hay', () => {
    expect(nombrePdfPresupuesto('2026-12-01', { nombre: 'Acme', apellido: '  ' })).toBe(
      'presupuesto-2026-12-01-acme',
    );
  });

  it('si no queda ningún carácter válido, va solo la fecha', () => {
    expect(nombrePdfPresupuesto('2026-12-01', { nombre: '***' })).toBe('presupuesto-2026-12-01');
  });
});
