import { describe, expect, it } from 'vitest';

import { formatearValor, nombreDeCampo } from './auditoria';

// HU-25 del backlog: cómo se leen los valores de la auditoría en el panel.
describe('auditoría: formato de los valores', () => {
  it('vacío es un guion y los booleanos se leen Sí o No', () => {
    expect(formatearValor('fotoUrl', null)).toBe('—');
    expect(formatearValor('activo', false)).toBe('No');
  });

  it('los importes se muestran en pesos y el porcentaje con su signo', () => {
    expect(formatearValor('precio', '1200.00')).toMatch(/1\.200/);
    expect(formatearValor('porcentajeMensual', '3.00')).toBe('3.00 %');
  });

  it('una fecha de calendario no se corre al día anterior', () => {
    expect(formatearValor('fecha', '2026-12-05T00:00:00.000Z')).toBe('5/12/26');
  });

  it('las líneas se leen cantidad por descripción, con su subtotal o «a cotizar»', () => {
    expect(
      formatearValor('lineas', [
        { cantidad: 2, descripcion: 'Coffee break', subtotal: '10000.00', aCotizar: false },
        { cantidad: 1, descripcion: 'Pantalla LED', subtotal: '0.00', aCotizar: true },
      ]),
    ).toMatch(/^2 × Coffee break \(.*10\.000\) · 1 × Pantalla LED \(a cotizar\)$/);
  });

  it('un campo sin nombre propio se lee separado en palabras', () => {
    expect(nombreDeCampo('precioBase')).toBe('Precio base');
    expect(nombreDeCampo('estado')).toBe('Estado');
  });
});
