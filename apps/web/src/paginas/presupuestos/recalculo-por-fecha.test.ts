import { mesesHastaEvento, proyectarPrecio } from '@confluens/shared';
import { describe, expect, it } from 'vitest';

import { cambiosDePrecio, type FuentesDePrecio, preciosParaFecha } from './recalculo-por-fecha';

// Hoy noviembre de 2026, incremento del 10% mensual: un año después son 12 meses, ×1,10^12.
const HOY = '2026-11-09';
const proyectar = (precio: string, fecha: string) =>
  proyectarPrecio(precio, '10', mesesHastaEvento(HOY, fecha));

const fuentes = (cambios: Partial<FuentesDePrecio> = {}): FuentesDePrecio => ({
  originalesSalon: new Map([[1, '1000.00']]),
  originalesLinea: new Map([
    ['linea-1', '100.00'],
    ['linea-2', '500.00'],
    ['linea-3', '80.00'],
  ]),
  fechaOriginal: '2026-11-19',
  jornadaOriginalCoincide: true,
  precioSalonCatalogo: () => '1000.00',
  precioServicioCatalogo: (id) => (id === 10 ? '100.00' : null),
  proyectar,
  ...cambios,
});

const salones = [{ salonId: 1, precio: '1000.00' }];
const lineas = [
  // Servicio propio del catálogo.
  { clave: 'linea-1', servicioId: 10, descripcion: 'Coffee', precio: '100.00', tercerizado: false },
  // Tercerizado: no recibe el incremento.
  { clave: 'linea-2', servicioId: 20, descripcion: 'Audio', precio: '500.00', tercerizado: true },
  // Adicional escrito a mano.
  {
    clave: 'linea-3',
    servicioId: null,
    descripcion: 'Flores',
    precio: '80.00',
    tercerizado: false,
  },
];

describe('preciosParaFecha (HU-54, cambio de fecha)', () => {
  it('pasar el evento un año adelante proyecta el salón y los servicios propios 12 meses', () => {
    const resultado = preciosParaFecha('2027-11-19', salones, lineas, fuentes());

    expect(resultado.salones[0]!.precio).toBe(proyectar('1000.00', '2027-11-19'));
    expect(resultado.salones[0]!.precio).toBe('3138.44');
    expect(resultado.lineas[0]!.precio).toBe('313.86');
  });

  it('no toca los tercerizados ni los adicionales escritos a mano', () => {
    const resultado = preciosParaFecha('2027-11-19', salones, lineas, fuentes());

    expect(resultado.lineas[1]!.precio).toBe('500.00');
    expect(resultado.lineas[2]!.precio).toBe('80.00');
  });

  it('pisa un ajuste a mano con el precio de la fecha nueva', () => {
    const ajustada = [{ ...lineas[0]!, precio: '50.00' }];

    const resultado = preciosParaFecha('2027-11-19', [], ajustada, fuentes());

    expect(resultado.lineas[0]!.precio).toBe('313.86');
  });

  it('al volver a la fecha original recupera los precios guardados', () => {
    const movidos = preciosParaFecha('2027-11-19', salones, lineas, fuentes());

    const resultado = preciosParaFecha('2026-11-19', movidos.salones, movidos.lineas, fuentes());

    expect(resultado.salones[0]!.precio).toBe('1000.00');
    expect(resultado.lineas[0]!.precio).toBe('100.00');
  });

  it('en la fecha original, una línea nueva toma el precio vigente proyectado a esa fecha', () => {
    const nueva = [{ ...lineas[0]!, clave: 'servicio-10-1', precio: '313.86' }];

    const resultado = preciosParaFecha('2026-11-19', [], nueva, fuentes());

    expect(resultado.lineas[0]!.precio).toBe('100.00');
  });

  it('con otra jornada el salón no vuelve al precio guardado', () => {
    const resultado = preciosParaFecha(
      '2026-11-19',
      salones,
      [],
      fuentes({ jornadaOriginalCoincide: false, precioSalonCatalogo: () => '600.00' }),
    );

    expect(resultado.salones[0]!.precio).toBe('600.00');
  });

  it('un servicio a cotizar en el catálogo conserva lo que tenía', () => {
    const aCotizar = [{ ...lineas[0]!, servicioId: 30 }];

    const resultado = preciosParaFecha('2027-11-19', [], aCotizar, fuentes());

    expect(resultado.lineas[0]!.precio).toBe('100.00');
  });
});

describe('cambiosDePrecio', () => {
  it('lista solo lo que ya estaba y cambió de precio', () => {
    const movidos = preciosParaFecha('2027-11-19', salones, lineas, fuentes());
    const { originalesSalon, originalesLinea } = fuentes();

    const cambios = cambiosDePrecio(
      movidos.salones,
      [...movidos.lineas, { ...lineas[0]!, clave: 'servicio-10-1', precio: '313.86' }],
      originalesSalon,
      originalesLinea,
      () => 'Paraná',
    );

    expect(cambios).toEqual([
      { clave: 'salon-1', descripcion: 'Salón Paraná', antes: '1000.00', ahora: '3138.44' },
      { clave: 'linea-1', descripcion: 'Coffee', antes: '100.00', ahora: '313.86' },
    ]);
  });
});
