import type { ChoqueDeSalon } from '@confluens/shared';
import { describe, expect, it } from 'vitest';

import { avisoDeChoques, textoDelDia } from './aviso-de-choques.js';

// El rechazo de un evento de varios días con salones ocupados (HU-50, `backlog.md`): lista TODOS los
// choques con día, salón, evento y horario, y dice cuántos días están libres. «Muy bien y muy claro».

// 09:00 y 18:00 en Córdoba (UTC-3) son las 12:00 y las 21:00 UTC.
const choque = (
  fecha: string,
  salon: string,
  eventoId: number,
  cliente: string,
  desde: string,
  hasta: string,
): ChoqueDeSalon => ({
  fecha,
  salon: { id: 1, nombre: salon },
  evento: {
    id: eventoId,
    estado: 'Reservado',
    cliente,
    inicio: `${fecha}T${desde}:00.000Z`,
    fin: `${fecha}T${hasta}:00.000Z`,
  },
});

describe('textoDelDia', () => {
  it('escribe el día de la semana y la fecha, sin que la zona corra la fecha', () => {
    expect(textoDelDia('2027-05-14')).toBe('viernes 14/05/2027');
    expect(textoDelDia('2027-05-01')).toBe('sábado 01/05/2027');
  });
});

describe('avisoDeChoques', () => {
  const choques = [
    choque('2027-05-14', 'Pucará', 52, 'Constructora Medina SRL', '12:00', '21:00'),
    choque('2027-05-15', 'Iguazú', 61, 'Agustina Herrera', '11:00', '15:00'),
  ];

  it('dice cuántos días chocan, lista cada choque y cuántos quedan libres', () => {
    const { mensaje } = avisoDeChoques(choques, 5, 'reservar');

    expect(mensaje).toBe(
      [
        'No se puede reservar el evento: 2 de sus 5 días tienen un salón ocupado.',
        '- viernes 14/05/2027 · Salón Pucará: reservado por el evento #52 (Constructora Medina SRL), de 09:00 a 18:00.',
        '- sábado 15/05/2027 · Salón Iguazú: reservado por el evento #61 (Agustina Herrera), de 08:00 a 12:00.',
        '',
        'Los otros 3 días están libres. Hablá con el cliente para mover el día, el horario o el salón.',
      ].join('\n'),
    );
  });

  it('el detalle trae una línea por choque con la fecha como campo', () => {
    const { detalles } = avisoDeChoques(choques, 5, 'reservar');

    expect(detalles.map((d) => d.campo)).toEqual(['2027-05-14', '2027-05-15']);
    expect(detalles[0]!.mensaje).toContain('Salón Pucará');
  });

  it('un día con dos salones ocupados cuenta como un solo día', () => {
    const { mensaje } = avisoDeChoques(
      [
        choque('2027-05-14', 'Pucará', 52, 'A', '12:00', '21:00'),
        choque('2027-05-14', 'Iguazú', 52, 'A', '12:00', '21:00'),
      ],
      3,
      'agendar',
    );

    expect(mensaje).toContain('1 de sus 3 días tiene un salón ocupado.');
    expect(mensaje).toContain('Los otros 2 días están libres.');
  });

  it('singular cuando queda un solo día libre y sin «libres» cuando no queda ninguno', () => {
    const uno = avisoDeChoques(
      [choque('2027-05-14', 'Pucará', 52, 'A', '12:00', '21:00')],
      2,
      'reservar',
    );
    expect(uno.mensaje).toContain('El otro día está libre.');

    const todos = avisoDeChoques(
      [
        choque('2027-05-14', 'Pucará', 52, 'A', '12:00', '21:00'),
        choque('2027-05-15', 'Pucará', 52, 'A', '12:00', '21:00'),
      ],
      2,
      'reservar',
    );
    expect(todos.mensaje).toContain('2 de sus 2 días tienen un salón ocupado.');
    expect(todos.mensaje).not.toContain('libre');
    expect(todos.mensaje).toContain('Hablá con el cliente');
  });
});
