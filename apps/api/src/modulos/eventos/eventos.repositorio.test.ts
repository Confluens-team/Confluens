import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-15: los filtros del calendario (rango de fechas, salones y estados) se arman en la consulta
// de Prisma, así que se prueba qué recibe findMany con un cliente falso (sin Postgres, igual que
// el resto de los tests).
const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock('../../lib/prisma.js', () => ({ prisma: { evento: { findMany, findFirst } } }));

const { buscarSolapamiento, cancelar, listarAgenda } = await import('./eventos.repositorio.js');

// RN-12: dos eventos no pueden ocupar el mismo salón al mismo tiempo. El borde es la clave: la base
// usa tsrange(inicio, fin), cerrado a la izquierda y abierto a la derecha, así que un evento que
// termina a las 18:00 y otro que empieza a las 18:00 NO chocan. La consulta previa tiene que
// coincidir con eso: desigualdades estrictas, nunca `lte`/`gte`.
describe('eventos.repositorio: buscarSolapamiento (RN-12)', () => {
  const inicio = new Date('2026-11-15T20:00:00.000Z');
  const fin = new Date('2026-11-16T02:00:00.000Z');

  beforeEach(() => {
    findFirst.mockReset();
    findFirst.mockResolvedValue(null);
  });

  const whereDeLaBusqueda = () => findFirst.mock.calls[0]![0].where;

  it('compara con desigualdades estrictas: tocarse en el borde no es solaparse', async () => {
    await buscarSolapamiento({ salonIds: [5], inicio, fin, excluirEventoId: 20 });

    // Existente.inicio < nuevo.fin  Y  existente.fin > nuevo.inicio.
    expect(whereDeLaBusqueda().inicio).toEqual({ lt: fin });
    expect(whereDeLaBusqueda().fin).toEqual({ gt: inicio });
    expect(whereDeLaBusqueda().inicio).not.toHaveProperty('lte');
    expect(whereDeLaBusqueda().fin).not.toHaveProperty('gte');
  });

  it('solo cuentan los eventos que ocupan el salón: Reservado y Cobrado, no EnConsulta ni Cancelado', async () => {
    await buscarSolapamiento({ salonIds: [5], inicio, fin, excluirEventoId: 20 });

    expect(whereDeLaBusqueda().estado).toEqual({ in: ['Reservado', 'Cobrado'] });
  });

  it('el evento no choca consigo mismo al reagendarse', async () => {
    await buscarSolapamiento({ salonIds: [5], inicio, fin, excluirEventoId: 20 });

    expect(whereDeLaBusqueda().id).toEqual({ not: 20 });
  });

  it('choca si comparte cualquiera de los salones del evento', async () => {
    await buscarSolapamiento({ salonIds: [5, 9], inicio, fin, excluirEventoId: 20 });

    expect(whereDeLaBusqueda().salones).toEqual({ some: { salonId: { in: [5, 9] } } });
  });

  it('devuelve el evento en conflicto, o null si el salón está libre', async () => {
    const enConflicto = { id: 55 };
    findFirst.mockResolvedValueOnce(enConflicto);

    expect(await buscarSolapamiento({ salonIds: [5], inicio, fin, excluirEventoId: 20 })).toBe(
      enConflicto,
    );
    expect(
      await buscarSolapamiento({ salonIds: [5], inicio, fin, excluirEventoId: 20 }),
    ).toBeNull();
  });
});

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
  const eventoUpdate = vi.fn();
  const tx = {
    presupuesto: { updateMany: presupuestoUpdateMany },
    evento: { update: eventoUpdate },
  };

  beforeEach(() => {
    presupuestoUpdateMany.mockReset();
    eventoUpdate.mockReset();
  });

  it('pasa el evento y sus presupuestos Estimado y Confirmado a Cancelado', async () => {
    await cancelar(20, tx as never);

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
    await cancelar(20, tx as never);

    expect(Object.keys(tx).sort()).toEqual(['evento', 'presupuesto']);
  });
});
