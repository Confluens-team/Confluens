import { describe, expect, it } from 'vitest';

import {
  agruparPorDia,
  horarioDeLosDias,
  resumenDeJornada,
  resumenDelEvento,
  textoDePersonas,
} from './dias-del-evento';

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

describe('resumenDelEvento', () => {
  it('un evento de un solo día se lee como siempre', () => {
    expect(resumenDelEvento({ cantidadPersonas: 80, tipoJornada: 'media', dias: [] })).toEqual({
      personas: '80 personas',
      jornada: 'Media jornada',
      dias: 1,
    });
  });

  it('con varios días muestra el rango de personas y dice si la jornada varía', () => {
    const resumen = resumenDelEvento({
      cantidadPersonas: 120,
      tipoJornada: 'completa',
      dias: [
        { cantidadPersonas: 50, tipoJornada: 'completa' },
        { cantidadPersonas: 120, tipoJornada: 'media' },
        { cantidadPersonas: 80, tipoJornada: 'completa' },
      ],
    });

    expect(resumen).toEqual({
      personas: '50 a 120 personas',
      jornada: 'Varía (completa y media)',
      dias: 3,
    });
  });
});

describe('horarioDeLosDias', () => {
  // 12:00Z a 21:00Z es de 09:00 a 18:00 en Córdoba.
  const dia = (fecha: string, desde = '12:00', hasta = '21:00') => ({
    inicio: `${fecha}T${desde}:00.000Z`,
    fin: `${fecha}T${hasta}:00.000Z`,
  });

  it('si todos los días tienen el mismo horario, lo dice una vez', () => {
    expect(horarioDeLosDias([dia('2042-09-10'), dia('2042-09-11')])).toBe(
      '09:00 a 18:00, todos los días',
    );
  });

  it('si cambia de un día a otro, lo avisa', () => {
    expect(horarioDeLosDias([dia('2042-09-10'), dia('2042-09-11', '13:00', '15:00')])).toBe(
      'El horario varía según el día',
    );
  });

  it('un día sin agendar deja el evento sin horario', () => {
    expect(horarioDeLosDias([dia('2042-09-10'), { inicio: null, fin: null }])).toBeNull();
    expect(horarioDeLosDias([])).toBeNull();
  });
});
