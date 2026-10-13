import { describe, expect, it } from 'vitest';

import { armadoDeSalones, nombresDeSalones } from './formato';

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
