import { describe, expect, it } from 'vitest';

import {
  diasDeLaFranja,
  fechasDeLaFranja,
  MAXIMO_DE_DIAS_DE_UN_EVENTO,
  sumarDias,
  ultimoDiaPermitido,
  validarFechasSeguidas,
  validarFranja,
} from './franja-de-dias.js';

// La tabla de «Casos de prueba de la validación del tope» de docs/producto/backlog.md (HU-50), con
// año: el tope se mide en días y no en meses, y el bisiesto y el cambio de año no corren la cuenta.
describe('franja de días de un evento (HU-50)', () => {
  it('el máximo es 32 días', () => {
    expect(MAXIMO_DE_DIAS_DE_UN_EVENTO).toBe(32);
  });

  it.each([
    ['un solo día', '2040-05-15', '2040-05-15', 1],
    ['28/04 al 28/05: cruza de abril a mayo', '2040-04-28', '2040-05-28', 31],
    ['30/04 al 30/05: de fin de abril a fin de mayo', '2040-04-30', '2040-05-30', 31],
    ['30/04 al 31/05: justo en el tope', '2040-04-30', '2040-05-31', 32],
    ['01/05 al 31/05: un mes completo', '2040-05-01', '2040-05-31', 31],
    ['01/03 al 31/03', '2040-03-01', '2040-03-31', 31],
    ['febrero bisiesto completo', '2044-02-01', '2044-02-29', 29],
    ['20/12 al 19/01: cruza el año', '2040-12-20', '2041-01-19', 31],
    ['20/12 al 20/01: cruza el año, justo en el tope', '2040-12-20', '2041-01-20', 32],
  ])('permite %s', (_nombre, inicio, fin, dias) => {
    expect(validarFranja(inicio, fin)).toEqual({ valida: true, dias });
  });

  it.each([
    ['30/04 al 01/06: un día más que el tope', '2040-04-30', '2040-06-01', 33],
    ['20/12 al 21/01: un día más que el tope', '2040-12-20', '2041-01-21', 33],
    ['todo un año', '2040-01-01', '2040-12-31', 366],
  ])('rechaza %s', (_nombre, inicio, fin, dias) => {
    expect(validarFranja(inicio, fin)).toEqual({ valida: false, motivo: 'supera-el-maximo', dias });
  });

  it('el año bisiesto cuenta un día más: la misma franja entra en un año y no en el otro', () => {
    // 15/02 al 17/03: en 2027 (28 días de febrero) son 31; en 2028 (29 días) son 32. Y al 18/03:
    // 32 en 2027 y 33 en 2028.
    expect(diasDeLaFranja('2027-02-15', '2027-03-17')).toBe(31);
    expect(diasDeLaFranja('2028-02-15', '2028-03-17')).toBe(32);
    expect(validarFranja('2027-02-15', '2027-03-18')).toEqual({ valida: true, dias: 32 });
    expect(validarFranja('2028-02-15', '2028-03-18')).toEqual({
      valida: false,
      motivo: 'supera-el-maximo',
      dias: 33,
    });
  });

  it('un día de fin anterior al de inicio no es una franja', () => {
    expect(validarFranja('2040-05-10', '2040-05-09')).toEqual({
      valida: false,
      motivo: 'fin-anterior-al-inicio',
      dias: 0,
    });
  });

  it.each([
    ['2040-02-30', '2040-03-02'], // el 30 de febrero no existe
    ['2040-05-10', '2040-13-01'],
    ['10/05/2040', '2040-05-11'],
    ['', '2040-05-11'],
  ])('rechaza una fecha que no es real (%s, %s)', (inicio, fin) => {
    expect(validarFranja(inicio, fin)).toEqual({ valida: false, motivo: 'fecha-invalida' });
    expect(diasDeLaFranja(inicio, fin)).toBeNull();
  });

  it('el último día permitido es el que deja la franja justo en 32 días (también al cruzar mes y año)', () => {
    expect(ultimoDiaPermitido('2040-04-30')).toBe('2040-05-31');
    expect(ultimoDiaPermitido('2040-12-20')).toBe('2041-01-20');
    expect(ultimoDiaPermitido('2044-02-01')).toBe('2044-03-03'); // bisiesto
    expect(ultimoDiaPermitido('2043-02-01')).toBe('2043-03-04'); // no bisiesto
    expect(ultimoDiaPermitido('no-es-una-fecha')).toBeNull();
    // Y es coherente con validarFranja: ese día entra, el siguiente no.
    for (const inicio of ['2040-04-30', '2040-12-20', '2044-02-01']) {
      const ultimo = ultimoDiaPermitido(inicio)!;
      expect(validarFranja(inicio, ultimo).valida).toBe(true);
      const siguiente = new Date(ultimo + 'T00:00:00Z');
      siguiente.setUTCDate(siguiente.getUTCDate() + 1);
      expect(validarFranja(inicio, siguiente.toISOString().slice(0, 10)).valida).toBe(false);
    }
  });

  it('lista cada fecha de la franja, también cruzando el fin de mes', () => {
    expect(fechasDeLaFranja('2040-04-29', '2040-05-02')).toEqual([
      '2040-04-29',
      '2040-04-30',
      '2040-05-01',
      '2040-05-02',
    ]);
    expect(fechasDeLaFranja('2040-05-15', '2040-05-15')).toEqual(['2040-05-15']);
    expect(fechasDeLaFranja('2040-04-30', '2040-06-01')).toEqual([]);
    expect(fechasDeLaFranja('2040-04-30', '2040-05-31')).toHaveLength(32);
  });

  describe('validarFechasSeguidas (los días que manda un pedido)', () => {
    it('acepta una franja en orden, también cruzando mes y año', () => {
      expect(validarFechasSeguidas(['2040-05-15'])).toEqual({ valida: true });
      expect(validarFechasSeguidas(['2040-04-30', '2040-05-01'])).toEqual({ valida: true });
      expect(validarFechasSeguidas(['2040-12-31', '2041-01-01'])).toEqual({ valida: true });
      expect(validarFechasSeguidas(fechasDeLaFranja('2040-04-30', '2040-05-31'))).toEqual({
        valida: true,
      });
    });

    it('rechaza un día libre en el medio, fechas repetidas o fuera de orden', () => {
      const noConsecutivas = { valida: false, motivo: 'no-consecutivas' };
      expect(validarFechasSeguidas(['2040-05-15', '2040-05-17'])).toEqual(noConsecutivas);
      expect(validarFechasSeguidas(['2040-05-15', '2040-05-15'])).toEqual(noConsecutivas);
      expect(validarFechasSeguidas(['2040-05-16', '2040-05-15'])).toEqual(noConsecutivas);
    });

    it('rechaza una fecha que no existe', () => {
      expect(validarFechasSeguidas(['2040-02-30'])).toEqual({
        valida: false,
        motivo: 'fecha-invalida',
      });
    });

    it('rechaza más de 32 días', () => {
      const treintaYTres = fechasDeLaFranja('2040-04-30', '2040-05-31').concat('2040-06-01');
      expect(validarFechasSeguidas(treintaYTres)).toEqual({
        valida: false,
        motivo: 'supera-el-maximo',
      });
    });
  });

  it('suma días al calendario sin que el cambio de mes o de año corra la cuenta', () => {
    expect(sumarDias('2040-04-30', 1)).toBe('2040-05-01');
    expect(sumarDias('2040-12-31', 1)).toBe('2041-01-01');
    expect(sumarDias('2044-02-28', 1)).toBe('2044-02-29'); // bisiesto
    expect(sumarDias('2040-05-01', -1)).toBe('2040-04-30');
    expect(sumarDias('2040-05-15', 0)).toBe('2040-05-15');
    expect(sumarDias('basura', 1)).toBeNull();
  });
});
