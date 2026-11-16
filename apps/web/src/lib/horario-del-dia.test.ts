import { describe, expect, it } from 'vitest';

import {
  type DiaParaAgendar,
  diaListoParaAgendar,
  faltaParaAgendar,
  horaGuardada,
  instanteDelDia,
  motivosSinAgendar,
  pedidoDeAgenda,
  superaCapacidad,
} from './horario-del-dia';

const dia = (cambios: Partial<DiaParaAgendar> = {}): DiaParaAgendar => ({
  fecha: '2026-12-07',
  inicio: '09:00',
  fin: '18:00',
  personas: 80,
  salones: [{ salonId: 1, distribucionId: '3', capacidad: 100 }],
  ...cambios,
});

describe('instanteDelDia', () => {
  it('arma el instante en la hora de Córdoba (UTC−3), sin depender del navegador', () => {
    expect(instanteDelDia('2026-12-07', '09:00', '09:00')).toBe('2026-12-07T12:00:00.000Z');
  });

  it('un fin antes del inicio es del día siguiente', () => {
    expect(instanteDelDia('2026-12-07', '02:00', '20:00')).toBe('2026-12-08T05:00:00.000Z');
  });

  it('vuelve a la hora guardada', () => {
    expect(horaGuardada('2026-12-07T12:00:00.000Z')).toBe('09:00');
    expect(horaGuardada(null)).toBe('');
  });
});

describe('diaListoParaAgendar', () => {
  it('pide las dos horas, distintas, y la distribución de cada salón', () => {
    expect(diaListoParaAgendar(dia())).toBe(true);
    expect(diaListoParaAgendar(dia({ fin: '' }))).toBe(false);
    expect(diaListoParaAgendar(dia({ fin: '09:00' }))).toBe(false);
    expect(
      diaListoParaAgendar(dia({ salones: [{ salonId: 1, distribucionId: '', capacidad: null }] })),
    ).toBe(false);
    expect(diaListoParaAgendar(dia({ salones: [] }))).toBe(false);
  });
});

describe('superaCapacidad', () => {
  it('suma la capacidad de las distribuciones del día', () => {
    expect(superaCapacidad(dia({ personas: 100 }))).toBe(false);
    expect(superaCapacidad(dia({ personas: 101 }))).toBe(true);
    expect(
      superaCapacidad(
        dia({
          personas: 150,
          salones: [
            { salonId: 1, distribucionId: '3', capacidad: 100 },
            { salonId: 2, distribucionId: '7', capacidad: 60 },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe('pedidoDeAgenda', () => {
  it('con todos los días completos arma el horario y la distribución de cada uno', () => {
    const pedido = pedidoDeAgenda(
      [dia(), dia({ fecha: '2026-12-08', inicio: '20:00', fin: '02:00', personas: 120 })],
      false,
    );
    expect(pedido).toEqual({
      distribuciones: [
        { salonId: 1, distribucionId: 3, fecha: '2026-12-07' },
        { salonId: 1, distribucionId: 3, fecha: '2026-12-08' },
      ],
      dias: [
        {
          fecha: '2026-12-07',
          inicio: '2026-12-07T12:00:00.000Z',
          fin: '2026-12-07T21:00:00.000Z',
        },
        {
          fecha: '2026-12-08',
          inicio: '2026-12-08T23:00:00.000Z',
          fin: '2026-12-09T05:00:00.000Z',
        },
      ],
      modalidadSalonRestaurante: false,
      confirmarCapacidadExcedida: true,
    });
  });

  it('si a un día le falta algo no se agenda nada', () => {
    expect(pedidoDeAgenda([dia(), dia({ inicio: '' })], false)).toBeNull();
    expect(pedidoDeAgenda([], false)).toBeNull();
  });
});

describe('faltaParaAgendar', () => {
  it('es null cuando el día está listo', () => {
    expect(faltaParaAgendar(dia())).toBeNull();
  });

  it('nombra lo que falta: horas, salón o distribución', () => {
    expect(faltaParaAgendar(dia({ inicio: '', fin: '' }))).toBe('las dos horas');
    expect(faltaParaAgendar(dia({ fin: '' }))).toBe('las dos horas');
    expect(faltaParaAgendar(dia({ fin: '09:00' }))).toBe(
      'una hora de fin distinta de la de inicio',
    );
    expect(
      faltaParaAgendar(dia({ salones: [{ salonId: 1, distribucionId: '', capacidad: null }] })),
    ).toBe('la distribución');
    expect(faltaParaAgendar(dia({ salones: [] }))).toBe('el salón');
  });

  it('junta varias faltas', () => {
    expect(
      faltaParaAgendar(
        dia({ inicio: '', salones: [{ salonId: 1, distribucionId: '', capacidad: null }] }),
      ),
    ).toBe('las dos horas y la distribución');
  });
});

describe('motivosSinAgendar', () => {
  const sinDistribucion = dia({ salones: [{ salonId: 1, distribucionId: '', capacidad: null }] });

  it('un solo día no se numera', () => {
    expect(motivosSinAgendar([sinDistribucion])).toEqual(['la distribución']);
  });

  it('con varios días numera solo los que faltan', () => {
    expect(motivosSinAgendar([dia(), sinDistribucion, dia({ fin: '' })])).toEqual([
      'Día 2: la distribución',
      'Día 3: las dos horas',
    ]);
  });

  it('es vacío si todos están listos', () => {
    expect(motivosSinAgendar([dia(), dia()])).toEqual([]);
  });
});
