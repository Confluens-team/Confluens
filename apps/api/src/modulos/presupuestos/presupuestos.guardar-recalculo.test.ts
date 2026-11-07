import { describe, expect, it, vi } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import type { LineaNueva, PresupuestoRecalculado } from './presupuestos.repositorio.js';

const { guardarRecalculo } = await import('./presupuestos.repositorio.js');

// HU-54 con HU-25 del backlog: el recálculo masivo corre en una sola transacción, así que se cuida
// cuántas consultas hace. Con un tx falso se cuenta qué se escribe.
function txFalso() {
  return {
    lineaPresupuesto: { deleteMany: vi.fn(), createMany: vi.fn() },
    presupuesto: { update: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn() },
  };
}

const D = (valor: string) => new Prisma.Decimal(valor);

const lineaAnterior = {
  descripcion: 'Coffee break',
  cantidad: 10,
  modalidad: 'Normal' as const,
  precioUnitario: D('1000'),
  subtotal: D('10000'),
  aCotizar: false,
};

function lineaNueva(subtotal: string): LineaNueva {
  return {
    servicioId: 1,
    salonId: null,
    descripcion: 'Coffee break',
    cantidad: 10,
    modalidad: 'Normal',
    precioBase: (Number(subtotal) / 10).toFixed(2),
    precioUnitario: (Number(subtotal) / 10).toFixed(2),
    subtotal,
    aCotizar: false,
    horaEstimada: null,
  };
}

function recalculado(id: number, subtotal: string): PresupuestoRecalculado {
  return {
    id,
    totalAnterior: D('10000'),
    lineasAnteriores: [lineaAnterior],
    lineas: [lineaNueva(subtotal)],
    total: subtotal,
  };
}

describe('presupuestos.repositorio: guardarRecalculo', () => {
  it('no vuelve a leer nada, escribe tres veces por presupuesto y audita todo en un solo insert', async () => {
    const tx = txFalso();

    const cambiaron = await guardarRecalculo(
      [recalculado(1, '11000.00'), recalculado(2, '12000.00')],
      tx as never,
    );

    expect(cambiaron).toBe(2);
    expect(tx.lineaPresupuesto.deleteMany).toHaveBeenCalledTimes(2);
    expect(tx.lineaPresupuesto.createMany).toHaveBeenCalledTimes(2);
    expect(tx.presupuesto.update).toHaveBeenCalledTimes(2);
    expect(tx.presupuesto.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { total: '11000.00' },
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).toHaveBeenCalledOnce();
    const filas = tx.auditLog.createMany.mock.calls[0]![0].data;
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      usuarioId: null,
      entidad: 'Presupuesto',
      entidadId: '1',
      campos: ['total', 'lineas'],
      valorAnterior: { total: '10000.00' },
      valorNuevo: { total: '11000.00' },
    });
  });

  it('un presupuesto que no cambia no se escribe ni se audita', async () => {
    const tx = txFalso();

    const cambiaron = await guardarRecalculo(
      [recalculado(1, '10000.00'), recalculado(2, '12000.00')],
      tx as never,
    );

    expect(cambiaron).toBe(1);
    expect(tx.presupuesto.update).toHaveBeenCalledOnce();
    expect(tx.presupuesto.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { total: '12000.00' },
    });
    expect(tx.auditLog.createMany.mock.calls[0]![0].data).toHaveLength(1);
  });

  it('sin cambios no escribe nada', async () => {
    const tx = txFalso();

    expect(await guardarRecalculo([recalculado(1, '10000.00')], tx as never)).toBe(0);
    expect(tx.lineaPresupuesto.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.createMany).not.toHaveBeenCalled();
  });
});
