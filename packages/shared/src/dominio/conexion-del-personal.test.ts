import { describe, expect, it } from 'vitest';

import { estadoDeConexion, MINUTOS_EN_LINEA } from './conexion-del-personal.js';

const ahora = new Date('2026-11-14T15:00:00.000Z');
const haceMinutos = (minutos: number) => new Date(ahora.getTime() - minutos * 60_000);
const estado = (ultimaActividad: Date | null, activo = true) =>
  estadoDeConexion({ ultimaActividad, activo, ahora, minutosDeSesion: 120 });

describe('estadoDeConexion', () => {
  it('con actividad hace menos de 5 minutos está en línea', () => {
    expect(MINUTOS_EN_LINEA).toBe(5);
    expect(estado(haceMinutos(0))).toBe('EnLinea');
    expect(estado(haceMinutos(4.9))).toBe('EnLinea');
  });

  it('a los 5 minutos justos ya está ausente', () => {
    expect(estado(haceMinutos(5))).toBe('Ausente');
    expect(estado(haceMinutos(60))).toBe('Ausente');
  });

  it('pasado el tiempo de la sesión no tiene sesión', () => {
    expect(estado(haceMinutos(119.9))).toBe('Ausente');
    expect(estado(haceMinutos(120))).toBe('SinSesion');
    expect(estado(haceMinutos(600))).toBe('SinSesion');
  });

  it('sin marca de actividad (nunca entró o cerró sesión) no tiene sesión', () => {
    expect(estado(null)).toBe('SinSesion');
  });

  it('un usuario dado de baja no tiene sesión aunque tenga una marca reciente', () => {
    expect(estado(haceMinutos(1), false)).toBe('SinSesion');
  });

  it('una marca en el futuro (reloj desfasado) cuenta como en línea', () => {
    expect(estado(haceMinutos(-2))).toBe('EnLinea');
  });

  it('respeta una sesión más corta que la de 2 horas', () => {
    expect(
      estadoDeConexion({
        ultimaActividad: haceMinutos(20),
        activo: true,
        ahora,
        minutosDeSesion: 15,
      }),
    ).toBe('SinSesion');
  });
});
