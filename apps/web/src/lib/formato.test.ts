import { describe, expect, it } from 'vitest';

import { armadoDeSalones, armadoDelEvento, haceCuanto, nombresDeSalones } from './formato';

// ADR 0011: un evento puede ocupar varios salones, cada uno con su distribución.
describe('nombresDeSalones', () => {
  it('une los nombres como se dicen en castellano', () => {
    expect(nombresDeSalones([{ nombre: 'Auditorio' }])).toBe('Auditorio');
    expect(nombresDeSalones([{ nombre: 'Auditorio' }, { nombre: 'Pucará' }])).toBe(
      'Auditorio y Pucará',
    );
    expect(
      nombresDeSalones([{ nombre: 'Auditorio' }, { nombre: 'Pucará' }, { nombre: 'Paraná' }]),
    ).toBe('Auditorio, Pucará y Paraná');
  });

  it('sin salones devuelve el texto de respaldo', () => {
    expect(nombresDeSalones([])).toBe('A definir');
    expect(nombresDeSalones([], 'a definir')).toBe('a definir');
  });
});

describe('armadoDeSalones', () => {
  const banquete = { nombre: 'Banquete' };
  const conferencia = { nombre: 'Conferencia' };

  it('si todos los salones usan el mismo armado, lo dice una sola vez', () => {
    expect(
      armadoDeSalones([
        { nombre: 'Auditorio', distribucion: banquete },
        { nombre: 'Pucará', distribucion: banquete },
      ]),
    ).toBe('Banquete');
  });

  it('si difieren, dice el de cada salón', () => {
    expect(
      armadoDeSalones([
        { nombre: 'Auditorio', distribucion: banquete },
        { nombre: 'Pucará', distribucion: conferencia },
      ]),
    ).toBe('Auditorio: Banquete · Pucará: Conferencia');
  });

  // Que todos los armados coincidan no alcanza para resumir: si a un salón le falta el suyo,
  // "Banquete" solo haría creer que el evento entero está armado.
  it('si a algún salón le falta el armado, no lo resume', () => {
    expect(
      armadoDeSalones([
        { nombre: 'Auditorio', distribucion: banquete },
        { nombre: 'Pucará', distribucion: null },
      ]),
    ).toBe('Auditorio: Banquete');
  });

  it('sin ningún salón armado devuelve null', () => {
    expect(armadoDeSalones([{ nombre: 'Auditorio', distribucion: null }])).toBeNull();
    expect(armadoDeSalones([])).toBeNull();
  });
});

// HU-50: cada día puede armar distinto el mismo salón.
describe('armadoDelEvento', () => {
  const banquete = { nombre: 'Banquete' };
  const teatro = { nombre: 'Teatro' };
  const dia = (distribucion: { nombre: string } | null) => ({
    salones: [{ nombre: 'Auditorio', distribucion }],
  });

  it('un evento de un solo día se resume como siempre', () => {
    const salones = [{ nombre: 'Auditorio', distribucion: banquete }];
    expect(armadoDelEvento({ salones, dias: [{ salones }] })).toBe('Banquete');
  });

  it('si todos los días usan el mismo armado, dice cuál', () => {
    const dias = [dia(banquete), dia(banquete)];
    expect(armadoDelEvento({ salones: dias[0]!.salones, dias })).toBe('Banquete');
  });

  it('si el armado cambia de un día a otro, no da el de uno solo por el de todos', () => {
    const dias = [dia(banquete), dia(teatro)];
    expect(armadoDelEvento({ salones: dias[0]!.salones, dias })).toBe('Varía según el día');
  });

  it('un día sin armar entre días armados también es «Varía»', () => {
    const dias = [dia(banquete), dia(null)];
    expect(armadoDelEvento({ salones: dias[0]!.salones, dias })).toBe('Varía según el día');
  });

  it('sin ningún armado es null', () => {
    const dias = [dia(null), dia(null)];
    expect(armadoDelEvento({ salones: dias[0]!.salones, dias })).toBeNull();
  });
});

describe('haceCuanto', () => {
  const ahora = new Date('2026-11-14T15:00:00.000Z');
  const hace = (minutos: number) => new Date(ahora.getTime() - minutos * 60_000);

  it('menos de un minuto es «hace un momento»', () => {
    expect(haceCuanto(hace(0), ahora)).toBe('hace un momento');
    expect(haceCuanto(hace(0.9), ahora)).toBe('hace un momento');
  });

  it('hasta una hora cuenta minutos', () => {
    expect(haceCuanto(hace(1), ahora)).toBe('hace 1 min');
    expect(haceCuanto(hace(3), ahora)).toBe('hace 3 min');
    expect(haceCuanto(hace(59), ahora)).toBe('hace 59 min');
  });

  it('desde una hora cuenta horas enteras', () => {
    expect(haceCuanto(hace(60), ahora)).toBe('hace 1 h');
    expect(haceCuanto(hace(119), ahora)).toBe('hace 1 h');
    expect(haceCuanto(hace(125), ahora)).toBe('hace 2 h');
  });

  it('un instante en el futuro (reloj desfasado) es «hace un momento»', () => {
    expect(haceCuanto(hace(-3), ahora)).toBe('hace un momento');
  });
});
