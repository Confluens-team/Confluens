import { describe, expect, it, vi } from 'vitest';

// Si el módulo se importa sin esto abre un cliente real de Prisma: acá todo pasa por el `tx` falso.
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

const { conActor } = await import('../../lib/auditoria.js');
const { actualizarEvento, reemplazarLineas, reemplazarSalonesDelEvento } =
  await import('./presupuestos.repositorio.js');

// HU-50 parte 1 (ADR 0014): fecha, inicio, fin, cantidadPersonas y tipoJornada son del DÍA y el evento
// solo guarda su resumen, que calcula la base. Escribir el resumen a mano lo rechaza un trigger, así que
// estos tests fijan que el repositorio no lo intenta: con un cliente falso, qué se escribe y dónde.
// Lo que garantiza Postgres (días consecutivos, tope, solapamiento por día) está en
// prisma/pruebas/evento-varios-dias.sql.

const DIA = 7;

function txFalso() {
  return {
    evento: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 20, estado: 'EnConsulta' }),
      update: vi.fn().mockResolvedValue({}),
    },
    eventoDia: {
      findFirstOrThrow: vi.fn().mockResolvedValue({ id: DIA }),
      update: vi.fn().mockResolvedValue({}),
    },
    eventoSalon: {
      // salonesDelEvento (auditoría) pide el nombre; reemplazarSalonesDelEvento pide los ids.
      findMany: vi
        .fn()
        .mockImplementation(({ select }: { select: Record<string, unknown> }) =>
          Promise.resolve(
            'salonId' in select
              ? [{ salonId: 1 }]
              : [{ salon: { nombre: 'Auditorio' }, distribucion: null }],
          ),
        ),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    presupuesto: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ eventoId: 20 }),
    },
    lineaPresupuesto: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { create: vi.fn() },
  };
}

const comoPersonal = <T>(ejecutar: () => Promise<T>) =>
  conActor({ usuarioId: 1, rol: 'RESPONSABLE_EVENTOS' }, ejecutar);

describe('presupuestos.repositorio: actualizarEvento (HU-50)', () => {
  it('lo que es del día va al día y el resto al evento, con el día primero', async () => {
    const tx = txFalso();
    const inicio = new Date('2026-11-20T12:00:00Z');
    const fin = new Date('2026-11-20T21:00:00Z');

    await comoPersonal(() =>
      actualizarEvento(
        20,
        {
          fecha: new Date('2026-11-20'),
          inicio,
          fin,
          cantidadPersonas: 50,
          tipoJornada: 'media',
          estado: 'Reservado',
          horaInicioEstimada: '10:00',
        },
        tx as never,
      ),
    );

    expect(tx.eventoDia.update).toHaveBeenCalledWith({
      where: { id: DIA },
      data: {
        fecha: new Date('2026-11-20'),
        inicio,
        fin,
        cantidadPersonas: 50,
        tipoJornada: 'media',
      },
    });
    // En el evento queda solo lo que no es del día: nunca el resumen.
    expect(tx.evento.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { estado: 'Reservado', horaInicioEstimada: '10:00' },
    });
    // El horario nuevo llega a los salones del día (RN-12) antes de cambiar el estado del evento.
    expect(tx.eventoDia.update.mock.invocationCallOrder[0]!).toBeLessThan(
      tx.evento.update.mock.invocationCallOrder[0]!,
    );
  });

  it('si cambia solo el estado no toca el día', async () => {
    const tx = txFalso();

    await comoPersonal(() => actualizarEvento(20, { estado: 'Cancelado' }, tx as never));

    expect(tx.eventoDia.update).not.toHaveBeenCalled();
    expect(tx.evento.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { estado: 'Cancelado' },
    });
  });

  it('si cambia solo el día no escribe el evento', async () => {
    const tx = txFalso();

    await comoPersonal(() => actualizarEvento(20, { cantidadPersonas: 80 }, tx as never));

    expect(tx.eventoDia.update).toHaveBeenCalledWith({
      where: { id: DIA },
      data: expect.objectContaining({ cantidadPersonas: 80 }),
    });
    expect(tx.evento.update).not.toHaveBeenCalled();
  });

  it('el día que se actualiza es el primero del evento', async () => {
    const tx = txFalso();

    await comoPersonal(() => actualizarEvento(20, { cantidadPersonas: 80 }, tx as never));

    expect(tx.eventoDia.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventoId: 20 }, orderBy: { fecha: 'asc' } }),
    );
  });
});

describe('presupuestos.repositorio: reemplazarSalonesDelEvento (HU-50)', () => {
  it('los salones nuevos se crean en el día del evento, con su distribución', async () => {
    const tx = txFalso();

    await comoPersonal(() =>
      reemplazarSalonesDelEvento(20, [1, 2], tx as never, new Map([[2, 9]])),
    );

    // Se compara y se quita dentro del día, no en todo el evento.
    expect(tx.eventoSalon.deleteMany).toHaveBeenCalledWith({
      where: { diaId: DIA, salonId: { notIn: [1, 2] } },
    });
    // El salón 1 ya estaba: solo se crea el 2.
    expect(tx.eventoSalon.create).toHaveBeenCalledTimes(1);
    expect(tx.eventoSalon.create).toHaveBeenCalledWith({
      data: { eventoId: 20, diaId: DIA, salonId: 2, distribucionId: 9 },
    });
  });
});

describe('presupuestos.repositorio: reemplazarLineas (HU-50)', () => {
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

  it('las líneas sin día toman el del evento y las que traen el suyo lo conservan', async () => {
    const tx = txFalso();

    await comoPersonal(() =>
      reemplazarLineas(30, [linea('sin día'), linea('con su día', 9)], tx as never),
    );

    expect(tx.presupuesto.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 30 },
      select: { eventoId: true },
    });
    const { data } = tx.lineaPresupuesto.createMany.mock.calls[0]![0] as {
      data: { diaId: number; presupuestoId: number }[];
    };
    expect(data.map((l) => l.diaId)).toEqual([DIA, 9]);
    expect(data.every((l) => l.presupuestoId === 30)).toBe(true);
  });
});
