import type { ChoqueDeSalon } from '@confluens/shared';
import { describe, expect, it } from 'vitest';

import {
  avisosDeLosDias,
  choquesPorFecha,
  diaDeSemanaCorto,
  esLunes,
  estadoDeDiaDeConsulta,
  estadoDeDiaDeEvento,
  numeroDelDia,
  resumenDelDia,
  textoDelDia,
} from './cinta-de-dias';

const choque = (fecha: string, salonId: number): ChoqueDeSalon => ({
  fecha,
  salon: { id: salonId, nombre: `Salón ${salonId}` },
  evento: { id: 131, estado: 'Reservado', cliente: 'Ana', inicio: null, fin: null },
});

describe('fechas de la cinta', () => {
  it('nombra el día sin correrlo por la zona horaria', () => {
    expect(diaDeSemanaCorto('2026-12-07')).toBe('Lun');
    expect(numeroDelDia('2026-12-07')).toBe(7);
    expect(textoDelDia('2026-12-08')).toBe('Martes 8 de diciembre');
    expect(textoDelDia('2026-12-08T00:00:00.000Z')).toBe('Martes 8 de diciembre');
  });

  it('reconoce el lunes para separar las semanas', () => {
    expect(esLunes('2026-12-07')).toBe(true);
    expect(esLunes('2026-12-08')).toBe(false);
  });
});

describe('estadoDeDiaDeEvento', () => {
  const base = { salones: [{}], lineas: 3, agendado: true, conflicto: false };

  it('un día con salón, servicios y horario está completo', () => {
    expect(estadoDeDiaDeEvento(base)).toBe('completo');
  });

  it('el conflicto gana sobre todo lo demás', () => {
    expect(estadoDeDiaDeEvento({ ...base, agendado: false, conflicto: true })).toBe('conflicto');
  });

  it('un día sin salón ni servicios está sin cargar', () => {
    expect(estadoDeDiaDeEvento({ ...base, salones: [], lineas: 0, agendado: false })).toBe(
      'sinCargar',
    );
  });

  it('sin horario, o con servicios pero sin salón, queda pendiente', () => {
    expect(estadoDeDiaDeEvento({ ...base, agendado: false })).toBe('pendiente');
    expect(estadoDeDiaDeEvento({ ...base, salones: [] })).toBe('pendiente');
  });
});

describe('estadoDeDiaDeConsulta', () => {
  const base = { salones: 1, lineas: 2, valido: true, conflicto: false };

  it('sigue el mismo orden: conflicto, vacío, incompleto, completo', () => {
    expect(estadoDeDiaDeConsulta({ ...base, conflicto: true })).toBe('conflicto');
    expect(estadoDeDiaDeConsulta({ ...base, salones: 0, lineas: 0, valido: false })).toBe(
      'sinCargar',
    );
    expect(estadoDeDiaDeConsulta({ ...base, valido: false })).toBe('pendiente');
    expect(estadoDeDiaDeConsulta(base)).toBe('completo');
  });
});

describe('choquesPorFecha', () => {
  it('agrupa los choques por el día que choca', () => {
    const porFecha = choquesPorFecha([
      choque('2026-12-10', 1),
      choque('2026-12-10', 2),
      choque('2026-12-11', 1),
    ]);
    expect(porFecha.get('2026-12-10')).toHaveLength(2);
    expect(porFecha.get('2026-12-11')).toHaveLength(1);
    expect(porFecha.has('2026-12-09')).toBe(false);
  });
});

describe('resumenDelDia', () => {
  it('une los salones y suma las personas', () => {
    expect(resumenDelDia(['Auditorio', 'Pucará'], 300)).toBe('Auditorio + Pucará · 300');
    expect(resumenDelDia([], null)).toBe('Sin salón');
    expect(resumenDelDia([], 40)).toBe('Sin salón · 40');
  });
});

describe('avisosDeLosDias', () => {
  it('primero los conflictos, con el evento que ocupa el salón, y después los días vacíos', () => {
    const avisos = avisosDeLosDias(
      [
        { fecha: '2026-12-10', estado: 'conflicto' },
        { fecha: '2026-12-11', estado: 'sinCargar' },
        { fecha: '2026-12-12', estado: 'sinCargar' },
      ],
      choquesPorFecha([
        {
          ...choque('2026-12-10', 1),
          evento: {
            id: 131,
            estado: 'Reservado',
            cliente: 'Ana',
            inicio: '2026-12-10T17:00:00.000Z',
            fin: '2026-12-10T21:00:00.000Z',
          },
        },
      ]),
    );
    expect(avisos.map((aviso) => [aviso.tono, aviso.indice])).toEqual([
      ['conflicto', 0],
      ['sinCargar', 1],
      ['sinCargar', 2],
    ]);
    expect(avisos[0]!.titulo).toBe('Jueves 10 en conflicto');
    expect(avisos[0]!.texto).toBe('El Salón 1 lo tiene el evento #131 (Ana) de 14:00 a 18:00.');
    expect(avisos[1]!.titulo).toBe('Viernes 11 sin cargar');
  });
});
