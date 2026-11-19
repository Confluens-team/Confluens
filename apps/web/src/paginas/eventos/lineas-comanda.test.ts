import type { ConsultaDetallada } from '@confluens/shared';
import { describe, expect, it } from 'vitest';

import { lineasDeComanda } from './lineas-comanda';

type Linea = ConsultaDetallada['lineas'][number];

const linea = (id: number, cambios: Partial<Linea>): Linea => ({
  id,
  diaId: 1,
  presupuestoId: 1,
  servicioId: id,
  salonId: null,
  descripcion: `Línea ${id}`,
  cantidad: 30,
  precioUnitario: '1000.00',
  subtotal: '30000.00',
  modalidad: 'Normal',
  precioBase: '1000.00',
  aCotizar: false,
  horaEstimada: null,
  tipo: 'servicio',
  tercerizado: false,
  admiteModalidad: false,
  ...cambios,
});

const descripciones = (lineas: Linea[]) => lineas.map((l) => l.descripcion);

describe('lineasDeComanda (HU-29)', () => {
  it('deja afuera la línea del salón y los servicios tercerizados', () => {
    const { gastronomia, aMano } = lineasDeComanda([
      linea(1, { tipo: 'salon', servicioId: null, salonId: 1, descripcion: 'Salón Auditorio' }),
      linea(2, { descripcion: 'Coffee break' }),
      linea(3, { tercerizado: true, descripcion: 'Pantalla LED' }),
    ]);

    expect(descripciones(gastronomia)).toEqual(['Coffee break']);
    expect(aMano).toEqual([]);
  });

  it('ordena la gastronomía por la hora a la que se la espera', () => {
    const { gastronomia } = lineasDeComanda([
      linea(1, { descripcion: 'Almuerzo', horaEstimada: '13:00' }),
      linea(2, { descripcion: 'Coffee de la tarde', horaEstimada: '16:30' }),
      linea(3, { descripcion: 'Desayuno', horaEstimada: '09:00' }),
    ]);

    expect(descripciones(gastronomia)).toEqual(['Desayuno', 'Almuerzo', 'Coffee de la tarde']);
  });

  it('los servicios sin hora van al final, en el orden en que se cargaron', () => {
    const { gastronomia } = lineasDeComanda([
      linea(1, { descripcion: 'Agua sin hora' }),
      linea(2, { descripcion: 'Almuerzo', horaEstimada: '13:00' }),
      linea(3, { descripcion: 'Café sin hora' }),
      linea(4, { descripcion: 'Desayuno', horaEstimada: '09:00' }),
    ]);

    expect(descripciones(gastronomia)).toEqual([
      'Desayuno',
      'Almuerzo',
      'Agua sin hora',
      'Café sin hora',
    ]);
  });

  it('los adicionales escritos a mano van aparte, en el orden en que se cargaron', () => {
    const { gastronomia, aMano } = lineasDeComanda([
      linea(1, { tipo: 'adicional', servicioId: null, descripcion: 'Torta de cumpleaños' }),
      linea(2, { descripcion: 'Lunch', horaEstimada: '12:00' }),
      linea(3, { tipo: 'adicional', servicioId: null, descripcion: 'Decoración' }),
    ]);

    expect(descripciones(gastronomia)).toEqual(['Lunch']);
    expect(descripciones(aMano)).toEqual(['Torta de cumpleaños', 'Decoración']);
  });

  it('un evento sin servicios de cocina deja la gastronomía vacía', () => {
    const { gastronomia } = lineasDeComanda([
      linea(1, { tipo: 'salon', servicioId: null, salonId: 1 }),
      linea(2, { tercerizado: true }),
    ]);

    expect(gastronomia).toEqual([]);
  });

  it('no modifica el arreglo que recibe', () => {
    const lineas = [linea(1, { horaEstimada: '13:00' }), linea(2, { horaEstimada: '09:00' })];

    lineasDeComanda(lineas);

    expect(lineas.map((l) => l.id)).toEqual([1, 2]);
  });
});
