import { hoyEnZonaEventos } from '@confluens/shared';
import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import type { PresupuestosRepositorio } from './presupuestos.repositorio.js';
import { recalcularEstimadosEnConsulta, recalcularLineas } from './presupuestos.servicio.js';

// HU-54 (dominio.md, «Recálculo automático»): al cambiar el porcentaje de incremento se recalculan
// los Estimado de eventos EnConsulta, sin reiniciar la vigencia.

const D = (valor: string) => new Prisma.Decimal(valor);

const parana = {
  id: 5,
  nombre: 'Paraná',
  precioJornadaCompleta: D('100000'),
  precioMediaJornada: D('80000'),
};

const linea = (datos: Record<string, unknown>) => ({
  servicioId: null,
  salonId: null,
  cantidad: 1,
  modalidad: 'Normal' as const,
  precioBase: null,
  aCotizar: false,
  horaEstimada: null,
  servicio: null,
  salon: null,
  ...datos,
});

type LineaParaRecalcular = Parameters<typeof recalcularLineas>[0][number];

// Un presupuesto con una línea de cada clase, con precios viejos: el salón, un coffee continuo, un
// tercerizado con precio, uno a cotizar y un adicional escrito a mano.
const lineasGuardadas = [
  linea({
    salonId: 5,
    salon: parana,
    descripcion: 'Salón Paraná (jornada completa)',
    precioUnitario: D('90000'),
    subtotal: D('90000'),
  }),
  linea({
    servicioId: 1,
    servicio: { id: 1, nombre: 'Coffee break', precio: D('1000'), tercerizado: false },
    descripcion: 'Coffee break',
    cantidad: 10,
    modalidad: 'Continuo',
    precioBase: D('900'),
    precioUnitario: D('1080'),
    subtotal: D('10800'),
    horaEstimada: '10:30',
  }),
  linea({
    servicioId: 2,
    servicio: { id: 2, nombre: 'Audiovisual', precio: D('6000'), tercerizado: true },
    descripcion: 'Audiovisual',
    precioBase: D('5000'),
    precioUnitario: D('5000'),
    subtotal: D('5000'),
  }),
  linea({
    servicioId: 3,
    servicio: { id: 3, nombre: 'Pantallas LED', precio: null, tercerizado: true },
    descripcion: 'Pantallas LED',
    precioUnitario: D('0'),
    subtotal: D('0'),
    aCotizar: true,
  }),
  linea({
    descripcion: 'Arreglo floral',
    cantidad: 2,
    precioUnitario: D('300'),
    subtotal: D('600'),
  }),
] as LineaParaRecalcular[];

describe('recalcularLineas (HU-54)', () => {
  const { lineas, total } = recalcularLineas(lineasGuardadas, { porcentaje: '10', meses: 1 });

  it('el salón toma el precio de su jornada, proyectado con el porcentaje nuevo (RN-13)', () => {
    expect(lineas[0]).toMatchObject({
      salonId: 5,
      descripcion: 'Salón Paraná (jornada completa)',
      precioUnitario: '110000.00',
      subtotal: '110000.00',
    });
  });

  it('un servicio del catálogo toma su base proyectada y conserva modalidad, cantidad y hora (RN-11)', () => {
    expect(lineas[1]).toMatchObject({
      servicioId: 1,
      modalidad: 'Continuo',
      precioBase: '1100.00',
      precioUnitario: '1320.00',
      cantidad: 10,
      subtotal: '13200.00',
      horaEstimada: '10:30',
    });
  });

  it('no cambian los tercerizados, lo que está a cotizar ni los adicionales escritos a mano', () => {
    expect(lineas[2]).toMatchObject({ precioUnitario: '5000.00', subtotal: '5000.00' });
    expect(lineas[3]).toMatchObject({ aCotizar: true, subtotal: '0.00' });
    expect(lineas[4]).toMatchObject({
      servicioId: null,
      salonId: null,
      precioUnitario: '300.00',
      subtotal: '600.00',
    });
  });

  it('el total suma las líneas recalculadas', () => {
    expect(total.toFixed(2)).toBe('128800.00');
  });
});

describe('recalcularEstimadosEnConsulta (HU-54)', () => {
  it('reemplaza las líneas y el total sin tocar la emisión ni el vencimiento', async () => {
    const tx = { soy: 'tx' } as unknown as Prisma.TransactionClient;
    // Un evento de este mismo mes: sin meses de proyección, los precios son los del catálogo.
    const repo = {
      listarEstimadosParaRecalcular: vi.fn().mockResolvedValue([
        {
          id: 31,
          evento: { fecha: new Date(`${hoyEnZonaEventos()}T00:00:00.000Z`) },
          total: D('100800'),
          lineas: [lineasGuardadas[0], lineasGuardadas[1]],
        },
      ]),
      guardarRecalculo: vi.fn(),
    } as unknown as PresupuestosRepositorio;

    const recalculados = await recalcularEstimadosEnConsulta('10', tx, repo);

    expect(recalculados).toBe(1);
    expect(repo.listarEstimadosParaRecalcular).toHaveBeenCalledWith(tx);
    // Todo el recálculo se guarda junto, con lo de antes ya leído (HU-25 del backlog: sin volver a
    // leer cada presupuesto para auditarlo).
    const [guardados, txGuardado] = vi.mocked(repo.guardarRecalculo).mock.calls[0]!;
    expect(txGuardado).toBe(tx);
    expect(guardados).toHaveLength(1);
    const [guardado] = guardados;
    expect(guardado).toMatchObject({ id: 31, total: '112000.00' });
    expect(guardado!.totalAnterior.toFixed(2)).toBe('100800.00');
    expect(guardado!.lineasAnteriores).toEqual([lineasGuardadas[0], lineasGuardadas[1]]);
    // Solo líneas y total: la vigencia no se reinicia y el estado no cambia.
    expect(guardado!.lineas.map((l) => l.subtotal)).toEqual(['100000.00', '12000.00']);
  });
});
