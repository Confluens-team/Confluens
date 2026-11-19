import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMany = vi.fn();
const findMany = vi.fn();
const createMany = vi.fn();

// $transaction corre el callback con el mismo cliente falso.
vi.mock('../lib/prisma.js', () => {
  const prisma: Record<string, unknown> = {
    presupuesto: { updateMany, findMany },
    auditLog: { createMany },
  };
  prisma['$transaction'] = (ejecutar: (tx: unknown) => unknown) => ejecutar(prisma);
  return { prisma };
});

const { controlarVigencia } = await import('./vigencia.trabajo.js');

describe('controlarVigencia (HU-10, RN-08)', () => {
  const ahora = new Date('2026-10-05T12:00:00.000Z');

  beforeEach(() => vi.clearAllMocks());

  it('pasa a Expirado solo los Estimado con la vigencia vencida, sin tocar el evento', async () => {
    findMany.mockResolvedValue([{ id: 3 }, { id: 8 }]);
    updateMany.mockResolvedValue({ count: 2 });

    const expirados = await controlarVigencia(ahora);

    expect(expirados).toBe(2);
    expect(findMany.mock.calls[0]![0].where).toEqual({
      estado: 'Estimado',
      venceEn: { lt: ahora },
    });
    expect(updateMany).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledWith({
      where: { estado: 'Estimado', venceEn: { lt: ahora }, id: { in: [3, 8] } },
      data: { estado: 'Expirado' },
    });
  });

  // HU-25 del backlog: lo que hace una tarea programada queda a nombre del Sistema.
  it('audita cada presupuesto vencido a nombre del Sistema', async () => {
    findMany.mockResolvedValue([{ id: 3 }]);
    updateMany.mockResolvedValue({ count: 1 });

    await controlarVigencia(ahora);

    expect(createMany.mock.calls[0]![0].data).toEqual([
      {
        usuarioId: null,
        entidad: 'Presupuesto',
        entidadId: '3',
        campos: ['estado'],
        valorAnterior: { estado: 'Estimado' },
        valorNuevo: { estado: 'Expirado' },
      },
    ]);
  });

  it('sin vencidos no escribe nada', async () => {
    findMany.mockResolvedValue([]);

    expect(await controlarVigencia(ahora)).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });
});
