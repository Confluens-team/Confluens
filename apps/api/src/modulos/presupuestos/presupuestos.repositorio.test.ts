import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-10: la búsqueda por cliente y el rango de fechas se arman en la consulta de Prisma, así que se
// prueba qué recibe findMany con un cliente falso (sin Postgres, igual que el resto de los tests).
const findMany = vi.fn();
const create = vi.fn();

vi.mock('../../lib/prisma.js', () => ({ prisma: { presupuesto: { findMany, create } } }));

const { crearPresupuestoConLineas, obtenerPresupuestos } =
  await import('./presupuestos.repositorio.js');

// HU-53: todo presupuesto nuevo requiere factura (RN-01). Es el único lugar donde se crean, así que
// cubre el cotizador, el alta del personal, la consulta social y la reutilización.
describe('presupuestos.repositorio: crearPresupuestoConLineas (HU-53)', () => {
  it('crea el presupuesto con factura, aunque la columna tenga default false', async () => {
    create.mockResolvedValue({});

    await crearPresupuestoConLineas({
      eventoId: 20,
      fechaEmision: new Date(),
      venceEn: null,
      total: '0.00',
      lineas: [],
    });

    expect(create.mock.calls[0]![0].data.requiereFactura).toBe(true);
  });
});

describe('presupuestos.repositorio: obtenerPresupuestos', () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it('ordena del más reciente al más antiguo por fecha de emisión', async () => {
    await obtenerPresupuestos({});

    expect(findMany.mock.calls[0]![0].orderBy).toEqual([{ fechaEmision: 'desc' }, { id: 'desc' }]);
  });

  it('sin filtro de estado excluye los Confirmado, que pasan a la agenda', async () => {
    await obtenerPresupuestos({});

    expect(findMany.mock.calls[0]![0].where.estado).toEqual({ not: 'Confirmado' });
  });

  it('nunca lista los Cancelados que se sacaron con el tacho, aunque se filtre por Cancelado', async () => {
    await obtenerPresupuestos({});
    await obtenerPresupuestos({ estado: 'Cancelado' });

    expect(findMany.mock.calls[0]![0].where.ocultoEn).toBeNull();
    expect(findMany.mock.calls[1]![0].where.ocultoEn).toBeNull();
  });

  it('cada palabra del cliente tiene que aparecer en el nombre, el apellido, el correo o la etiqueta', async () => {
    await obtenerPresupuestos({ cliente: 'Marina Gómez' });

    const { cliente } = findMany.mock.calls[0]![0].where.evento;
    expect(cliente.AND).toEqual(
      ['Marina', 'Gómez'].map((palabra) => ({
        OR: [
          { nombre: { contains: palabra, mode: 'insensitive' } },
          { apellido: { contains: palabra, mode: 'insensitive' } },
          { correo: { contains: palabra, mode: 'insensitive' } },
          { etiqueta: { nombre: { contains: palabra, mode: 'insensitive' } } },
        ],
      })),
    );
  });

  it('acota la fecha del evento con desde y hasta, ambos inclusive', async () => {
    await obtenerPresupuestos({ estado: 'Estimado', desde: '2026-11-01', hasta: '2026-11-30' });

    const { where } = findMany.mock.calls[0]![0];
    expect(where.estado).toBe('Estimado');
    expect(where.evento.fecha).toEqual({
      gte: new Date('2026-11-01'),
      lte: new Date('2026-11-30'),
    });
  });
});
