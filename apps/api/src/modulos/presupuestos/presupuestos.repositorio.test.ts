import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-10: la búsqueda por cliente y el rango de fechas se arman en la consulta de Prisma, así que se
// prueba qué recibe findMany con un cliente falso (sin Postgres, igual que el resto de los tests).
const findMany = vi.fn();
const create = vi.fn();
const auditLog = { create: vi.fn() };
// HU-50: las líneas nacen con el único día del evento.
const findFirstOrThrowDia = vi.fn().mockResolvedValue({ id: 7 });

// $transaction corre el callback con el mismo cliente falso: alcanza para ver qué se escribe.
vi.mock('../../lib/prisma.js', () => {
  const prisma: Record<string, unknown> = {
    presupuesto: { findMany, create },
    eventoDia: { findFirstOrThrow: findFirstOrThrowDia },
    auditLog,
  };
  prisma['$transaction'] = (ejecutar: (tx: unknown) => unknown) => ejecutar(prisma);
  return { prisma };
});

const { conActor } = await import('../../lib/auditoria.js');
const { crearPresupuestoConLineas, obtenerPresupuestos } =
  await import('./presupuestos.repositorio.js');

// HU-53: todo presupuesto nuevo requiere factura (RN-01). Es el único lugar donde se crean, así que
// cubre el cotizador, el alta del personal, la consulta social y la reutilización.
describe('presupuestos.repositorio: crearPresupuestoConLineas (HU-53)', () => {
  it('crea el presupuesto con factura, aunque la columna tenga default false', async () => {
    create.mockResolvedValue({ id: 5, requiereFactura: true, lineas: [], evento: {} });

    await conActor({ usuarioId: 1, rol: 'RESPONSABLE_EVENTOS' }, () =>
      crearPresupuestoConLineas({
        eventoId: 20,
        fechaEmision: new Date(),
        venceEn: null,
        total: '0.00',
        lineas: [],
      }),
    );

    expect(create.mock.calls[0]![0].data.requiereFactura).toBe(true);
  });

  // HU-25 del backlog: el alta del presupuesto queda en la auditoría, en la misma transacción.
  it('registra el alta en la auditoría a nombre del usuario de la sesión', async () => {
    auditLog.create.mockClear();
    create.mockResolvedValue({ id: 5, estado: 'Estimado', lineas: [], evento: {} });

    await conActor({ usuarioId: 3, rol: 'RESPONSABLE_EVENTOS' }, () =>
      crearPresupuestoConLineas({
        eventoId: 20,
        fechaEmision: new Date(),
        venceEn: null,
        total: '0.00',
        lineas: [],
      }),
    );

    expect(auditLog.create.mock.calls[0]![0].data).toMatchObject({
      usuarioId: 3,
      entidad: 'Presupuesto',
      entidadId: '5',
      valorAnterior: undefined,
      valorNuevo: { estado: 'Estimado', lineas: [] },
    });
  });

  // HU-50 parte 1: cada línea es de un día. Todos los eventos tienen uno solo, así que las que no
  // traen día toman el primero del evento; una que ya trae el suyo lo conserva.
  it('las líneas nacen con el único día del evento, salvo que traigan el suyo', async () => {
    create.mockResolvedValue({ id: 5, estado: 'Estimado', lineas: [], evento: {} });
    const linea = (descripcion: string, diaId?: number) => ({
      servicioId: null,
      salonId: null,
      descripcion,
      cantidad: 1,
      modalidad: 'Normal' as const,
      precioBase: null,
      precioUnitario: '100.00',
      subtotal: '100.00',
      aCotizar: false,
      horaEstimada: null,
      ...(diaId !== undefined && { diaId }),
    });

    await conActor({ usuarioId: 1, rol: 'RESPONSABLE_EVENTOS' }, () =>
      crearPresupuestoConLineas({
        eventoId: 20,
        fechaEmision: new Date(),
        venceEn: null,
        total: '200.00',
        lineas: [linea('sin día'), linea('con su día', 9)],
      }),
    );

    expect(findFirstOrThrowDia).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventoId: 20 }, orderBy: { fecha: 'asc' } }),
    );
    const lineas = create.mock.calls.at(-1)![0].data.lineas.create;
    expect(lineas.map((l: { diaId: number }) => l.diaId)).toEqual([7, 9]);
  });

  it('el alta que hace el cliente desde el cotizador no se audita', async () => {
    auditLog.create.mockClear();
    create.mockResolvedValue({ id: 6, estado: 'Estimado', lineas: [], evento: {} });

    await conActor({ usuarioId: 40, rol: 'CLIENTE' }, () =>
      crearPresupuestoConLineas({
        eventoId: 21,
        fechaEmision: new Date(),
        venceEn: null,
        total: '0.00',
        lineas: [],
      }),
    );

    expect(auditLog.create).not.toHaveBeenCalled();
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
