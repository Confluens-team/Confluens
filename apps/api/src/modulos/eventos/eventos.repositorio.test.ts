import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-15: los filtros del calendario (rango de fechas, salones y estados) se arman en la consulta
// de Prisma, así que se prueba qué recibe findMany con un cliente falso (sin Postgres, igual que
// el resto de los tests).
const findMany = vi.fn();

vi.mock('../../lib/prisma.js', () => ({ prisma: { evento: { findMany } } }));

const { listarAgenda } = await import('./eventos.repositorio.js');

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

  // Criterio 3: "puedo filtrar por uno o varios salones".
  it('filtra por varios salones a la vez', async () => {
    await listarAgenda({ salonId: [1, 3] });

    expect(whereDeLaConsulta().salonId).toEqual({ in: [1, 3] });
  });

  it('sin filtro de salón no acota por salón', async () => {
    await listarAgenda();

    expect(whereDeLaConsulta().salonId).toBeUndefined();
  });

  it('acota la fecha del evento con desde y hasta, ambos inclusive', async () => {
    await listarAgenda({ desde: '2026-11-01', hasta: '2026-11-30' });

    expect(whereDeLaConsulta().fecha).toEqual({
      gte: new Date('2026-11-01'),
      lte: new Date('2026-11-30'),
    });
  });
});
