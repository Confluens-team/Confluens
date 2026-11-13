import { describe, expect, it } from 'vitest';

import {
  diasDeCotizacion,
  esquemaCrearConsultaSocial,
  esquemaCrearPresupuesto,
} from './crear-presupuesto.esquema.js';
import {
  aModificacionDeUnDia,
  diasDeModificacion,
  esquemaModificarPresupuesto,
} from './modificar-presupuesto.esquema.js';

// HU-50: el pedido de un solo día sigue aceptándose con los campos sueltos de siempre, y el de
// varios días trae `dias`. Las dos formas llegan al servicio como la misma lista de días.

const contacto = { nombre: 'Ana', telefono: '3511234567', correo: 'ana@example.com' };
const unDia = (fecha: string) => ({
  fecha,
  cantidadPersonas: 40,
  tipoJornada: 'completa' as const,
  salonIds: [1],
});

describe('esquemaCrearPresupuesto', () => {
  it('acepta un solo día con los campos sueltos y lo ve como un día', () => {
    const datos = esquemaCrearPresupuesto.parse({ ...contacto, ...unDia('2040-05-15') });
    expect(diasDeCotizacion(datos)).toEqual([{ ...unDia('2040-05-15'), servicios: [] }]);
  });

  it('acepta varios días consecutivos, cada uno con lo suyo', () => {
    const datos = esquemaCrearPresupuesto.parse({
      ...contacto,
      dias: [
        { ...unDia('2040-04-30'), cantidadPersonas: 50 },
        { ...unDia('2040-05-01'), salonIds: [2, 3], tipoJornada: 'media' },
      ],
    });
    const dias = diasDeCotizacion(datos);
    expect(dias).toHaveLength(2);
    expect(dias[1]).toMatchObject({ salonIds: [2, 3], tipoJornada: 'media', servicios: [] });
  });

  it('rechaza un día libre en el medio y los días fuera de orden', () => {
    for (const fechas of [
      ['2040-05-15', '2040-05-17'],
      ['2040-05-16', '2040-05-15'],
    ]) {
      const resultado = esquemaCrearPresupuesto.safeParse({
        ...contacto,
        dias: fechas.map(unDia),
      });
      expect(resultado.success).toBe(false);
      expect(JSON.stringify(resultado.error?.issues)).toContain('consecutivos');
    }
  });

  it('rechaza más de 32 días', () => {
    const fechas = Array.from({ length: 33 }, (_, i) => {
      const fecha = new Date(Date.UTC(2040, 3, 30 + i));
      return fecha.toISOString().slice(0, 10);
    });
    const resultado = esquemaCrearPresupuesto.safeParse({ ...contacto, dias: fechas.map(unDia) });
    expect(resultado.success).toBe(false);
  });

  it('exige un salón en cada día', () => {
    const resultado = esquemaCrearPresupuesto.safeParse({
      ...contacto,
      dias: [unDia('2040-05-15'), { ...unDia('2040-05-16'), salonIds: [] }],
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['dias', 1, 'salonIds']);
  });

  it('no mezcla `dias` con los campos sueltos', () => {
    const resultado = esquemaCrearPresupuesto.safeParse({
      ...contacto,
      ...unDia('2040-05-15'),
      dias: [unDia('2040-05-15')],
    });
    expect(resultado.success).toBe(false);
  });

  it('conserva los errores de siempre cuando falta un dato del único día', () => {
    const { fecha: _fecha, ...sinFecha } = unDia('2040-05-15');
    const resultado = esquemaCrearPresupuesto.safeParse({ ...contacto, ...sinFecha });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((i) => i.path[0])).toContain('fecha');
  });
});

describe('esquemaCrearConsultaSocial con franja', () => {
  const base = {
    fecha: '2040-04-30',
    cantidadPersonas: 80,
    tipoJornada: 'completa' as const,
    tipoSocial: 'Casamiento',
  };

  it('acepta una fecha de fin dentro de los 32 días, también al cruzar el mes', () => {
    expect(esquemaCrearConsultaSocial.safeParse({ ...base, fechaFin: '2040-05-31' }).success).toBe(
      true,
    );
    expect(esquemaCrearConsultaSocial.safeParse({ ...base }).success).toBe(true);
  });

  it('rechaza un fin pasado de los 32 días o anterior al inicio', () => {
    const muyLarga = esquemaCrearConsultaSocial.safeParse({ ...base, fechaFin: '2040-06-01' });
    expect(muyLarga.success).toBe(false);
    expect(muyLarga.error?.issues[0]?.message).toBe('El evento puede durar hasta 32 días');
    expect(esquemaCrearConsultaSocial.safeParse({ ...base, fechaFin: '2040-04-29' }).success).toBe(
      false,
    );
  });
});

describe('esquemaModificarPresupuesto', () => {
  const dia = (fecha: string) => ({
    fecha,
    cantidadPersonas: 30,
    tipoJornada: 'media' as const,
    salones: [{ salonId: 1 }],
    servicios: [],
    adicionales: [],
  });

  it('acepta un solo día con los campos sueltos de siempre', () => {
    const datos = esquemaModificarPresupuesto.parse({ ...dia('2040-05-15') });
    expect(diasDeModificacion(datos)).toEqual([dia('2040-05-15')]);
    expect(aModificacionDeUnDia(datos)).toMatchObject({
      fecha: '2040-05-15',
      salones: [{ salonId: 1 }],
    });
  });

  it('acepta varios días y cambia la franja mandando más o menos fechas', () => {
    const datos = esquemaModificarPresupuesto.parse({
      dias: [dia('2040-05-15'), dia('2040-05-16'), dia('2040-05-17')],
    });
    expect(diasDeModificacion(datos).map((d) => d.fecha)).toEqual([
      '2040-05-15',
      '2040-05-16',
      '2040-05-17',
    ]);
  });

  it('no deja sacar un día del medio ni pasar de 32', () => {
    expect(
      esquemaModificarPresupuesto.safeParse({ dias: [dia('2040-05-15'), dia('2040-05-17')] })
        .success,
    ).toBe(false);
  });

  it('un corporativo necesita salón en cada día', () => {
    const resultado = esquemaModificarPresupuesto.safeParse({
      tipo: 'Corporativo',
      dias: [dia('2040-05-15'), { ...dia('2040-05-16'), salones: [] }],
    });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['dias', 1, 'salones']);
  });

  it('una consulta social puede tener días sin salón', () => {
    const resultado = esquemaModificarPresupuesto.safeParse({
      tipo: 'Social',
      tipoSocial: 'Casamiento',
      dias: [
        { ...dia('2040-05-15'), salones: [] },
        { ...dia('2040-05-16'), salones: [] },
      ],
    });
    expect(resultado.success).toBe(true);
  });

  it('en la forma de un día falta fecha, personas o jornada: sigue fallando por campo', () => {
    const resultado = esquemaModificarPresupuesto.safeParse({ salones: [{ salonId: 1 }] });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      'cantidadPersonas',
      'fecha',
      'tipoJornada',
    ]);
  });
});
