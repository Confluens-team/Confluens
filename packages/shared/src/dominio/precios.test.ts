import { describe, expect, it } from 'vitest';

import {
  aplicarModalidad,
  hoyEnZonaEventos,
  mesesHastaEvento,
  proyectarPrecio,
} from './precios.js';

describe('aplicarModalidad (RN-11)', () => {
  it('normal no suma recargo', () => {
    expect(aplicarModalidad('10500.00', 'Normal')).toBe('10500.00');
  });

  it('continuo suma 20% y en mesas 30% sobre el precio base', () => {
    expect(aplicarModalidad('10500', 'Continuo')).toBe('12600.00');
    expect(aplicarModalidad(10500, 'EnMesa')).toBe('13650.00');
  });

  it('redondea al centavo', () => {
    expect(aplicarModalidad('0.05', 'Continuo')).toBe('0.06');
  });
});

describe('mesesHastaEvento (S-10: el incremento entra el día 1)', () => {
  it('un evento en el mes en curso no se proyecta', () => {
    expect(mesesHastaEvento('2026-10-16', '2026-10-31')).toBe(0);
  });

  it('cuenta meses calendario, no días', () => {
    expect(mesesHastaEvento('2026-10-31', '2026-11-01')).toBe(1);
    expect(mesesHastaEvento('2026-10-16', '2027-01-15')).toBe(3);
  });

  it('una fecha pasada da 0', () => {
    expect(mesesHastaEvento('2026-10-16', '2026-08-01')).toBe(0);
  });
});

describe('proyectarPrecio (RN-13)', () => {
  it('con 0% o 0 meses devuelve el precio actual', () => {
    expect(proyectarPrecio('150000', 0, 6)).toBe('150000.00');
    expect(proyectarPrecio('150000', '3.5', 0)).toBe('150000.00');
  });

  it('es compuesto', () => {
    // 100000 × 1.1 × 1.1 = 121000
    expect(proyectarPrecio('100000', 10, 2)).toBe('121000.00');
  });

  it('acepta porcentajes con decimales y redondea al centavo cada mes', () => {
    // 1000 × 1.025 = 1025 → × 1.025 = 1050.625 → 1050.63
    expect(proyectarPrecio('1000.00', '2.5', 2)).toBe('1050.63');
  });
});

describe('hoyEnZonaEventos (ADR 0010)', () => {
  it('a las 23 h de Córdoba sigue siendo el mismo día aunque en UTC ya sea el siguiente', () => {
    expect(hoyEnZonaEventos(new Date('2026-10-17T02:00:00.000Z'))).toBe('2026-10-16');
  });
});
