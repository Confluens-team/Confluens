import { describe, expect, it } from 'vitest';

import { correspondenciaDeDias } from './correspondencia-de-dias.js';

// HU-50: al cambiar la franja, cada día se identifica por su fecha. Esta cuenta decide qué día de antes
// es cada día de ahora; el repositorio mueve las filas con ella y el servicio corre los horarios.

const dia = (fecha: string) => new Date(`${fecha}T00:00:00Z`).getTime();
const fechas = (...lista: string[]) => lista.map(dia);

describe('correspondenciaDeDias', () => {
  it('si la franja entera se corrió, cada día conserva su lugar', () => {
    const resultado = correspondenciaDeDias(
      fechas('2040-04-30', '2040-05-01', '2040-05-02'),
      fechas('2040-05-02', '2040-05-03', '2040-05-04'),
    );

    expect(resultado).toEqual({ corrida: true, origen: [0, 1, 2], corrimientoEnDias: 2 });
  });

  it('un corrimiento hacia atrás también lo es, con el signo al revés', () => {
    const resultado = correspondenciaDeDias(
      fechas('2040-05-02', '2040-05-03'),
      fechas('2040-04-30', '2040-05-01'),
    );

    expect(resultado).toMatchObject({ corrida: true, corrimientoEnDias: -2 });
  });

  it('si se extiende al final, los días que siguen se quedan y el nuevo entra vacío', () => {
    const resultado = correspondenciaDeDias(
      fechas('2040-05-01', '2040-05-02'),
      fechas('2040-05-01', '2040-05-02', '2040-05-03'),
    );

    expect(resultado).toEqual({ corrida: false, origen: [0, 1, null], corrimientoEnDias: 0 });
  });

  it('si se extiende o se achica al principio, cada día conserva su fecha', () => {
    expect(
      correspondenciaDeDias(
        fechas('2040-05-02', '2040-05-03'),
        fechas('2040-05-01', '2040-05-02', '2040-05-03'),
      ).origen,
    ).toEqual([null, 0, 1]);
    expect(
      correspondenciaDeDias(
        fechas('2040-05-01', '2040-05-02', '2040-05-03'),
        fechas('2040-05-02', '2040-05-03'),
      ).origen,
    ).toEqual([1, 2]);
  });

  it('el mismo largo con una fecha distinta en un extremo no es un corrimiento', () => {
    // 01-02-03 pasa a 01-02-04: el último día cambió, los otros no se movieron.
    const resultado = correspondenciaDeDias(
      fechas('2040-05-01', '2040-05-02', '2040-05-03'),
      fechas('2040-05-01', '2040-05-02', '2040-05-04'),
    );

    expect(resultado.corrida).toBe(false);
    expect(resultado.origen).toEqual([0, 1, null]);
  });

  it('una franja que queda igual no se mueve', () => {
    const resultado = correspondenciaDeDias(
      fechas('2040-05-01', '2040-05-02'),
      fechas('2040-05-01', '2040-05-02'),
    );

    expect(resultado).toEqual({ corrida: false, origen: [0, 1], corrimientoEnDias: 0 });
  });

  it('el cambio de mes y de año no corre la cuenta', () => {
    const resultado = correspondenciaDeDias(
      fechas('2040-12-30', '2040-12-31'),
      fechas('2041-01-01', '2041-01-02'),
    );

    expect(resultado).toMatchObject({ corrida: true, corrimientoEnDias: 2 });
  });
});
