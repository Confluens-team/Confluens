import type { ChoqueDeSalon } from '@confluens/shared';
import { describe, expect, it } from 'vitest';

import {
  avisosDeLosDias,
  choquesPorFecha,
  clasificarChoques,
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
          relacion: 'pisa' as const,
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

// El otro evento tiene el salón 1 el 10/12 de 09:00 a 18:00 (hora de Córdoba, UTC−3).
const ocupado = (
  inicio: string | null = '2026-12-10T12:00:00.000Z',
  fin: string | null = '2026-12-10T21:00:00.000Z',
) => ({
  ...choque('2026-12-10', 1),
  evento: { id: 96, estado: 'Reservado' as const, cliente: 'Ana', inicio, fin },
});
const dia =
  (inicio: string, fin: string, salonIds = [1]) =>
  () => ({ inicio, fin, salonIds });
const relaciones = (
  choques = [ocupado()],
  delDia: Parameters<typeof clasificarChoques>[1] = dia('', ''),
) => clasificarChoques(choques, delDia).map((c) => c.relacion);

describe('clasificarChoques', () => {
  it('es conflicto solo si los horarios se superponen', () => {
    expect(relaciones(undefined, dia('10:00', '12:00'))).toEqual(['pisa']);
    expect(relaciones(undefined, dia('08:00', '09:30'))).toEqual(['pisa']);
  });

  it('el mismo salón y día a otra hora no se pisa', () => {
    expect(relaciones(undefined, dia('18:55', '23:00'))).toEqual(['distinto']);
    expect(relaciones(undefined, dia('06:00', '08:00'))).toEqual(['distinto']);
  });

  it('los extremos que se tocan no se pisan', () => {
    expect(relaciones(undefined, dia('18:00', '22:00'))).toEqual(['distinto']);
    expect(relaciones(undefined, dia('07:00', '09:00'))).toEqual(['distinto']);
  });

  it('sin las dos horas del día no se sabe', () => {
    expect(relaciones(undefined, dia('', ''))).toEqual(['sinHorario']);
    expect(relaciones(undefined, dia('18:00', ''))).toEqual(['sinHorario']);
    expect(relaciones(undefined, dia('18:00', '18:00'))).toEqual(['sinHorario']);
    expect(relaciones(undefined, () => undefined)).toEqual(['sinHorario']);
  });

  it('un día que cruza la medianoche se compara con su fin del día siguiente', () => {
    expect(relaciones(undefined, dia('22:00', '03:00'))).toEqual(['distinto']);
    // El otro evento de 20:00 a 02:00 (23:00Z a 05:00Z del día siguiente) sí se pisa con 22:00 a 03:00.
    const nocturno = ocupado('2026-12-10T23:00:00.000Z', '2026-12-11T05:00:00.000Z');
    expect(relaciones([nocturno], dia('22:00', '03:00'))).toEqual(['pisa']);
  });

  it('si el otro evento no tiene horario no se puede descartar: se toma como choque', () => {
    expect(relaciones([ocupado(null, null)], dia('18:55', '23:00'))).toEqual(['pisa']);
  });

  it('descarta el salón que ya no está elegido en el formulario', () => {
    expect(relaciones(undefined, dia('10:00', '12:00', [2]))).toEqual([]);
  });
});

describe('avisosDeLosDias con el horario del día', () => {
  const avisosDe = (delDia: ReturnType<typeof dia>) =>
    avisosDeLosDias(
      [{ fecha: '2026-12-10', estado: 'completo' }],
      choquesPorFecha(clasificarChoques([ocupado()], delDia)),
    );

  it('si no se pisa, es un aviso suave que lo dice', () => {
    const [aviso] = avisosDe(dia('18:55', '23:00'));
    expect(aviso!.tono).toBe('pendiente');
    expect(aviso!.titulo).toBe('Jueves 10: salón ocupado a otra hora');
    expect(aviso!.texto).toBe(
      'El Salón 1 lo tiene el evento #96 (Ana) de 09:00 a 18:00: con tu horario no se pisan.',
    );
  });

  it('si todavía no hay horario, pide cargarlo para saber', () => {
    const [aviso] = avisosDe(dia('', ''));
    expect(aviso!.tono).toBe('pendiente');
    expect(aviso!.titulo).toBe('Jueves 10: salón con otro evento');
    expect(aviso!.texto).toBe(
      'El Salón 1 lo tiene el evento #96 (Ana) de 09:00 a 18:00. Cargá el horario del día para saber si se pisan.',
    );
  });

  it('si se pisa, es conflicto', () => {
    const [aviso] = avisosDe(dia('10:00', '12:00'));
    expect(aviso!.tono).toBe('conflicto');
    expect(aviso!.titulo).toBe('Jueves 10 en conflicto');
  });

  it('un salón que ya no está elegido no genera aviso', () => {
    expect(avisosDe(dia('10:00', '12:00', [2]))).toEqual([]);
  });
});
