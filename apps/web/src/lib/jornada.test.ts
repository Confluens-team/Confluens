import { describe, expect, it } from 'vitest';

import { duracionEnMinutos, jornadaDeHoras, textoHorarioEstimado } from './jornada';

describe('jornadaDeHoras', () => {
  it('toma como media jornada una duración de hasta 4 horas inclusive', () => {
    expect(jornadaDeHoras('09:00', '13:00')).toBe('media');
    expect(jornadaDeHoras('09:00', '12:30')).toBe('media');
  });

  it('toma como jornada completa lo que pasa de 4 horas', () => {
    expect(jornadaDeHoras('09:00', '13:01')).toBe('completa');
    expect(jornadaDeHoras('09:00', '18:00')).toBe('completa');
  });

  it('suma bien un evento que cruza la medianoche', () => {
    expect(duracionEnMinutos('21:00', '01:00')).toBe(4 * 60);
    expect(jornadaDeHoras('21:00', '01:00')).toBe('media');
    expect(jornadaDeHoras('21:00', '03:00')).toBe('completa');
  });

  it('queda en jornada completa si falta alguna de las dos horas', () => {
    expect(jornadaDeHoras('', '')).toBe('completa');
    expect(jornadaDeHoras('09:00', '')).toBe('completa');
    expect(jornadaDeHoras('', '13:00')).toBe('completa');
  });
});

describe('textoHorarioEstimado', () => {
  it('muestra el rango, solo el inicio o que falta definirlo', () => {
    expect(textoHorarioEstimado('21:00', '01:00')).toBe('21:00 a 01:00 h');
    expect(textoHorarioEstimado('21:00')).toBe('Desde 21:00 h');
    expect(textoHorarioEstimado(null, null)).toBe('A definir');
  });
});
