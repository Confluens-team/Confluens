import { describe, expect, it } from 'vitest';

import { agruparPorDia, resumenDeJornada, textoDePersonas } from './dias-del-evento';

// Las reglas de pantalla de HU-50 para un evento de varios días: el PO pidió ver el rango de
// personas y, si la jornada cambia de un día a otro, «Varía» aclarando cuáles.

describe('textoDePersonas', () => {
  it('un solo número si todos los días tienen las mismas personas', () => {
    expect(textoDePersonas([80])).toBe('80 personas');
    expect(textoDePersonas([80, 80, 80])).toBe('80 personas');
  });

  it('el rango, del mínimo al máximo, si varían', () => {
    expect(textoDePersonas([120, 50, 80])).toBe('50 a 120 personas');
  });

  it('sin días no hay nada que mostrar', () => {
    expect(textoDePersonas([])).toBe('');
  });
});

describe('resumenDeJornada', () => {
  it('si todos los días tienen la misma jornada, dice cuál es', () => {
    expect(resumenDeJornada(['completa', 'completa'])).toEqual({
      texto: 'Jornada completa',
      varia: false,
    });
    expect(resumenDeJornada(['media'])).toEqual({ texto: 'Media jornada', varia: false });
  });

  it('si varían, dice «Varía» y aclara cuáles, en el orden en que aparecen', () => {
    expect(resumenDeJornada(['media', 'completa', 'media'])).toEqual({
      texto: 'Varía (media y completa)',
      varia: true,
    });
    expect(resumenDeJornada(['completa', 'media']).texto).toBe('Varía (completa y media)');
  });
});

describe('agruparPorDia', () => {
  it('reparte las líneas por día y conserva el orden de los días y de las líneas', () => {
    const lineas = [
      { id: 1, diaId: 10 },
      { id: 2, diaId: 10 },
      { id: 3, diaId: 11 },
      { id: 4, diaId: 12 },
      { id: 5, diaId: 12 },
    ];
    const grupos = agruparPorDia(lineas);
    expect(grupos.map((g) => [g.diaId, g.lineas.map((l) => l.id)])).toEqual([
      [10, [1, 2]],
      [11, [3]],
      [12, [4, 5]],
    ]);
  });

  it('las líneas sin día quedan juntas', () => {
    expect(agruparPorDia<{ id: number; diaId?: number }>([{ id: 1 }, { id: 2 }])).toEqual([
      { diaId: undefined, lineas: [{ id: 1 }, { id: 2 }] },
    ]);
  });
});
