import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-15: los filtros del calendario (rango de fechas, salones y estados) se arman en la consulta
// de Prisma, así que se prueba qué recibe findMany con un cliente falso (sin Postgres, igual que
// el resto de los tests).
const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock('../../lib/prisma.js', () => ({ prisma: { evento: { findMany, findFirst } } }));

const { conActor } = await import('../../lib/auditoria.js');
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
  // HU-50: la comparación es contra el horario de CADA DÍA del otro evento (su renglón del salón), no
  // contra el resumen del evento: así un evento de varios días no ocupa las noches entre un día y otro.
  const renglonDelSalon = () => whereDeLaBusqueda().salones.some;

  it('compara con desigualdades estrictas: tocarse en el borde no es solaparse', async () => {
    await buscarSolapamiento({ salonIds: [5], inicio, fin, excluirEventoId: 20 });

    // Existente.inicio < nuevo.fin  Y  existente.fin > nuevo.inicio.
    expect(renglonDelSalon().inicio).toEqual({ lt: fin });
    expect(renglonDelSalon().fin).toEqual({ gt: inicio });
    expect(renglonDelSalon().inicio).not.toHaveProperty('lte');
    expect(renglonDelSalon().fin).not.toHaveProperty('gte');
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

    // El salón y el horario se piden sobre el MISMO renglón: no vale un salón de un día y un horario de otro.
    expect(renglonDelSalon()).toMatchObject({ salonId: { in: [5, 9] } });
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

  // HU-50: un evento de varios días entra si alguno de sus días cae en el rango, no solo el primero:
  // empieza antes del final del rango y termina después de su comienzo.
  it('acota por rango superpuesto, con desde y hasta inclusive', async () => {
    await listarAgenda({ desde: '2026-11-01', hasta: '2026-11-30' });

    expect(whereDeLaConsulta().fecha).toEqual({ lte: new Date('2026-11-30') });
    expect(whereDeLaConsulta().fechaFin).toEqual({ gte: new Date('2026-11-01') });
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
