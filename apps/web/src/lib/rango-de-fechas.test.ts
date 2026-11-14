import { describe, expect, it } from 'vitest';

import {
  diaMaximoParaElegir,
  elegirDia,
  estadoInicialDeRango,
  textoDeDias,
  type EstadoDeRango,
} from './rango-de-fechas';

// Los clics del selector de franja, como los pidió el PO (HU-50, 12/11/2026): sin pantalla de por
// medio. Las fechas son del calendario, así que el cambio de mes no corre la cuenta.

const vacio = estadoInicialDeRango('', '');
const clics = (dias: string[], desde: EstadoDeRango = vacio) =>
  dias.reduce((estado, dia) => elegirDia(estado, dia), desde);

describe('elegirDia', () => {
  it('un solo clic deja un evento de un día y espera el segundo', () => {
    expect(clics(['2040-05-15'])).toEqual({
      inicio: '2040-05-15',
      fin: '2040-05-15',
      esperandoFin: true,
    });
  });

  it('el segundo clic en el mismo día también deja un solo día', () => {
    expect(clics(['2040-05-15', '2040-05-15'])).toEqual({
      inicio: '2040-05-15',
      fin: '2040-05-15',
      esperandoFin: false,
    });
  });

  it('el segundo clic en un día posterior conecta la franja', () => {
    expect(clics(['2040-05-15', '2040-05-19'])).toEqual({
      inicio: '2040-05-15',
      fin: '2040-05-19',
      esperandoFin: false,
    });
  });

  it('el segundo clic en un día anterior lo toma como nuevo inicio', () => {
    expect(clics(['2040-05-15', '2040-05-10'])).toEqual({
      inicio: '2040-05-10',
      fin: '2040-05-10',
      esperandoFin: true,
    });
  });

  it('un tercer clic empieza una elección nueva', () => {
    expect(clics(['2040-05-15', '2040-05-19', '2040-06-02'])).toEqual({
      inicio: '2040-06-02',
      fin: '2040-06-02',
      esperandoFin: true,
    });
  });

  it('una franja de fin de abril a fin de mayo se puede armar (32 días contando los dos)', () => {
    expect(clics(['2040-04-30', '2040-05-31'])).toMatchObject({
      inicio: '2040-04-30',
      fin: '2040-05-31',
      esperandoFin: false,
    });
  });

  it('un fin más allá de los 32 días no arma una franja inválida: es un inicio nuevo', () => {
    expect(clics(['2040-04-30', '2040-06-01'])).toEqual({
      inicio: '2040-06-01',
      fin: '2040-06-01',
      esperandoFin: true,
    });
  });

  it('reabrir un selector con una franja ya elegida no la toma como un primer clic a medias', () => {
    const reabierto = estadoInicialDeRango('2040-05-15', '2040-05-19');
    expect(elegirDia(reabierto, '2040-05-22')).toEqual({
      inicio: '2040-05-22',
      fin: '2040-05-22',
      esperandoFin: true,
    });
  });
});

describe('diaMaximoParaElegir', () => {
  it('con el inicio elegido, el último día es el que deja la franja en 32 días', () => {
    expect(diaMaximoParaElegir(clics(['2040-04-30']))).toBe('2040-05-31');
    expect(diaMaximoParaElegir(clics(['2044-02-01']))).toBe('2044-03-03'); // bisiesto
  });

  it('sin una elección en curso no hay tope', () => {
    expect(diaMaximoParaElegir(vacio)).toBeUndefined();
    expect(diaMaximoParaElegir(clics(['2040-05-15', '2040-05-16']))).toBeUndefined();
  });
});

describe('textoDeDias', () => {
  it('cuenta los días de la franja, contando el de inicio y el de fin', () => {
    expect(textoDeDias('2040-05-15', '2040-05-15')).toBe('1 día');
    expect(textoDeDias('2040-04-30', '2040-05-02')).toBe('3 días');
    expect(textoDeDias('2040-05-15', '')).toBe('1 día');
  });
});
