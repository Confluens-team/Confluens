import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-15: los filtros del calendario (rango de fechas, salones y estados) se arman en la consulta
// de Prisma, así que se prueba qué recibe findMany con un cliente falso (sin Postgres, igual que
// el resto de los tests).
const findMany = vi.fn();

vi.mock('../../lib/prisma.js', () => ({ prisma: { evento: { findMany } } }));

const { conActor } = await import('../../lib/auditoria.js');
const { cancelar, listarAgenda } = await import('./eventos.repositorio.js');

const whereDeLaConsulta = () => findMany.mock.calls[0]![0].where;

describe('eventos.repositorio: listarAgenda', () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it('ordena por fecha y, dentro del día, por horario de inicio', async () => {
    await listarAgenda();

    expect(findMany.mock.calls[0]![0].orderBy).toEqual([{ fecha: 'asc' }, { inicio: 'asc' }]);
  });

  // Criterio 2: los Cancelado no se muestran por defecto. Un EnConsulta tampoco, porque no ocupa
  // el salón (criterio 5: la franja se lee como disponible igual).
  it('sin filtro de estado devuelve solo los eventos que ocupan el salón', async () => {
    await listarAgenda();

    expect(whereDeLaConsulta().estado).toEqual({ in: ['Reservado', 'Cobrado'] });
  });

  it('con estado explícito usa esos estados, incluso los Cancelado', async () => {
    await listarAgenda({ estado: ['Cancelado'] });

    expect(whereDeLaConsulta().estado).toEqual({ in: ['Cancelado'] });
  });

  // Criterio 3: "puedo filtrar por uno o varios salones". Desde que un evento puede ocupar
  // varios (ADR 0011), acierta si ocupa alguno de los pedidos.
  it('filtra por varios salones a la vez', async () => {
    await listarAgenda({ salonId: [1, 3] });

    expect(whereDeLaConsulta().salones).toEqual({ some: { salonId: { in: [1, 3] } } });
  });

  it('un evento con varios salones entra si alguno coincide con el filtro', async () => {
    await listarAgenda({ salonId: [3] });

    expect(whereDeLaConsulta().salones).toEqual({ some: { salonId: { in: [3] } } });
  });

  it('sin filtro de salón no acota por salón', async () => {
    await listarAgenda();

    expect(whereDeLaConsulta().salones).toBeUndefined();
  });

  it('acota la fecha del evento con desde y hasta, ambos inclusive', async () => {
    await listarAgenda({ desde: '2026-11-01', hasta: '2026-11-30' });

    expect(whereDeLaConsulta().fecha).toEqual({
      gte: new Date('2026-11-01'),
      lte: new Date('2026-11-30'),
    });
  });
});

// HU-23: cancelar el evento no borra nada ni toca los pagos (RN-06: lo abonado no se reintegra, y
// S-01 sigue abierto). Solo cambia el estado del evento y el de sus presupuestos activos, y el
// trigger de EventoSalon libera el salón al propagar el estado (ADR 0011).
describe('eventos.repositorio: cancelar', () => {
  const presupuestoUpdateMany = vi.fn();
  const presupuestoFindMany = vi.fn();
  const eventoUpdate = vi.fn();
  const eventoFindUniqueOrThrow = vi.fn();
  const auditLogCreateMany = vi.fn();
  const tx = {
    presupuesto: { updateMany: presupuestoUpdateMany, findMany: presupuestoFindMany },
    evento: { update: eventoUpdate, findUniqueOrThrow: eventoFindUniqueOrThrow },
    auditLog: { createMany: auditLogCreateMany },
  };
  // Cancela el personal: la auditoría toma el usuario de la sesión (HU-25 del backlog).
  const cancelarComo = (usuarioId: number) =>
    conActor({ usuarioId, rol: 'RESPONSABLE_EVENTOS' }, () => cancelar(20, tx as never));

  beforeEach(() => {
    vi.clearAllMocks();
    presupuestoFindMany.mockResolvedValue([{ id: 7, estado: 'Confirmado' }]);
    eventoFindUniqueOrThrow.mockResolvedValue({ id: 20, estado: 'Reservado' });
    eventoUpdate.mockResolvedValue({ id: 20, estado: 'Cancelado' });
  });

  it('pasa el evento y sus presupuestos Estimado y Confirmado a Cancelado', async () => {
    await cancelarComo(1);

    expect(presupuestoUpdateMany).toHaveBeenCalledWith({
      where: { eventoId: 20, estado: { in: ['Estimado', 'Confirmado'] } },
      data: { estado: 'Cancelado' },
    });
    expect(eventoUpdate).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { estado: 'Cancelado' },
    });
  });

  it('no toca los pagos del evento', async () => {
    await cancelarComo(1);

    expect(Object.keys(tx).sort()).toEqual(['auditLog', 'evento', 'presupuesto']);
  });

  it('audita el estado del evento y el de cada presupuesto cancelado', async () => {
    await cancelarComo(4);

    expect(auditLogCreateMany.mock.calls[0]![0].data).toEqual([
      expect.objectContaining({
        usuarioId: 4,
        entidad: 'Evento',
        entidadId: '20',
        valorAnterior: { estado: 'Reservado' },
        valorNuevo: { estado: 'Cancelado' },
      }),
      expect.objectContaining({
        entidad: 'Presupuesto',
        entidadId: '7',
        valorAnterior: { estado: 'Confirmado' },
        valorNuevo: { estado: 'Cancelado' },
      }),
    ]);
  });
});
