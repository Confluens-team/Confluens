import type { ConsultaDetallada } from '@confluens/shared';
import { describe, expect, it } from 'vitest';

import { horarioDelDia, horarioSalon } from './horario-salon';

const evento = (cambios: Partial<ConsultaDetallada['evento']>): ConsultaDetallada['evento'] => ({
  id: 1,
  estado: 'EnConsulta',
  fecha: '2026-11-15',
  fechaFin: '2026-11-15',
  cantidadPersonas: 30,
  tipo: 'Corporativo',
  tipoSocial: null,
  tipoSocialDetalle: null,
  horaInicioEstimada: null,
  horaFinEstimada: null,
  comentariosCliente: null,
  observacionesComanda: null,
  inicio: null,
  fin: null,
  ...cambios,
});

describe('horarioSalon', () => {
  it('con el evento agendado da el rango real en la hora de Córdoba', () => {
    // 19:00 y 22:00 UTC son las 16 y las 19 en Córdoba (UTC-3).
    expect(
      horarioSalon(evento({ inicio: '2026-11-15T19:00:00.000Z', fin: '2026-11-15T22:00:00.000Z' })),
    ).toBe('16.00 a 19.00 hs');
  });

  it('sin agendar usa la hora estimada que eligió el cliente', () => {
    expect(horarioSalon(evento({ horaInicioEstimada: '09:30' }))).toBe('Desde 09.30 hs');
  });

  it('con la hora de fin estimada da el rango que dejó el cliente', () => {
    expect(horarioSalon(evento({ horaInicioEstimada: '21:00', horaFinEstimada: '01:00' }))).toBe(
      'Desde 21.00 hasta 01.00 hs',
    );
  });

  it('el horario agendado manda sobre la hora estimada', () => {
    expect(
      horarioSalon(
        evento({
          horaInicioEstimada: '09:30',
          inicio: '2026-11-15T13:00:00.000Z',
          fin: '2026-11-15T17:00:00.000Z',
        }),
      ),
    ).toBe('10.00 a 14.00 hs');
  });

  it('sin ninguna de las dos queda a confirmar', () => {
    expect(horarioSalon(evento({}))).toBe('A confirmar horario');
  });
});

describe('horarioDelDia (S-16)', () => {
  const dia = (
    cambios: Partial<ConsultaDetallada['dias'][number]>,
  ): ConsultaDetallada['dias'][number] => ({
    id: 1,
    fecha: '2026-11-16',
    cantidadPersonas: 30,
    tipoJornada: 'completa',
    inicio: null,
    fin: null,
    horaInicioEstimada: null,
    horaFinEstimada: null,
    salones: [],
    ...cambios,
  });

  it('con el día agendado da su rango real', () => {
    expect(
      horarioDelDia(
        dia({ inicio: '2026-11-16T12:00:00.000Z', fin: '2026-11-16T21:00:00.000Z' }),
        evento({ horaInicioEstimada: '08:00' }),
      ),
    ).toBe('09.00 a 18.00 hs');
  });

  it('sin agendar usa el horario que pidió el cliente para ese día', () => {
    expect(
      horarioDelDia(
        dia({ horaInicioEstimada: '14:00', horaFinEstimada: '17:30' }),
        evento({ horaInicioEstimada: '09:00' }),
      ),
    ).toBe('Desde 14.00 hasta 17.30 hs');
  });

  it('sin horario propio usa el del evento', () => {
    expect(horarioDelDia(dia({}), evento({ horaInicioEstimada: '09:00' }))).toBe('Desde 09.00 hs');
  });
});
