import type { ConsultaDetallada } from '@confluens/shared';
import { describe, expect, it } from 'vitest';

import { horarioSalon } from './horario-salon';

const evento = (cambios: Partial<ConsultaDetallada['evento']>): ConsultaDetallada['evento'] => ({
  id: 1,
  estado: 'EnConsulta',
  fecha: '2026-11-15',
  cantidadPersonas: 30,
  tipo: 'Corporativo',
  tipoSocial: null,
  tipoSocialDetalle: null,
  horaInicioEstimada: null,
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
