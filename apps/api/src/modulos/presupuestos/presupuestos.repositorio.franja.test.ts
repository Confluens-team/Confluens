import { describe, expect, it, vi } from 'vitest';

// Si el módulo se importa sin esto abre un cliente real de Prisma: acá todo pasa por el `tx` falso.
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));

const { conActor } = await import('../../lib/auditoria.js');
const { crearDiasDelEvento, reemplazarDiasYLineas } = await import('./presupuestos.repositorio.js');

// HU-50 parte 2: cambiar la franja de un evento EnConsulta. Cada día se identifica por su fecha; si la
// franja entera se corrió, cada fila se mueve y conserva su lugar. La fecha es única por evento
// (@@unique([eventoId, fecha])), así que el orden en que se mueven las filas importa: se prueba contra
// un `tx` falso que RECHAZA una fecha repetida, como lo haría la base.

interface Dia {
  id: number;
  fecha: Date;
  cantidadPersonas: number;
  tipoJornada: string;
}

const dia = (id: number, fecha: string): Dia => ({
  id,
  fecha: new Date(fecha),
  cantidadPersonas: 50,
  tipoJornada: 'completa',
});

function txConDias(actuales: Dia[]) {
  const filas = actuales.map((d) => ({ ...d }));
  let siguienteId = 900;
  return {
    filas,
    movimientos: [] as number[],
    presupuesto: { findUniqueOrThrow: vi.fn().mockResolvedValue({ eventoId: 20 }) },
    eventoDia: {
      findMany: vi.fn(() => Promise.resolve(filas.map((f) => ({ ...f })))),
      update: vi.fn(({ where, data }: { where: { id: number }; data: Partial<Dia> }) => {
        const fila = filas.find((f) => f.id === where.id)!;
        if (
          data.fecha &&
          filas.some((f) => f.id !== fila.id && f.fecha.getTime() === data.fecha!.getTime())
        ) {
          return Promise.reject(new Error('Unique constraint: (eventoId, fecha)'));
        }
        Object.assign(fila, data);
        return Promise.resolve(fila);
      }),
      create: vi.fn(({ data }: { data: Omit<Dia, 'id'> }) => {
        if (filas.some((f) => f.fecha.getTime() === data.fecha.getTime())) {
          return Promise.reject(new Error('Unique constraint: (eventoId, fecha)'));
        }
        const fila = { id: siguienteId++, ...data };
        filas.push(fila);
        return Promise.resolve({ id: fila.id });
      }),
      deleteMany: vi.fn(({ where }: { where: { id: { in: number[] } } }) => {
        for (const id of where.id.in)
          filas.splice(
            filas.findIndex((f) => f.id === id),
            1,
          );
        return Promise.resolve({ count: where.id.in.length });
      }),
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

const nuevoDia = (fecha: string) => ({
  fecha: new Date(fecha),
  cantidadPersonas: 50,
  tipoJornada: 'completa' as const,
});
const linea = (fechaDia: string) => ({
  servicioId: null,
  salonId: 5,
  descripcion: 'Salón Paraná (jornada completa)',
  cantidad: 1,
  modalidad: 'Normal' as const,
  precioBase: null,
  precioUnitario: '100.00',
  subtotal: '100.00',
  aCotizar: false,
  horaEstimada: null,
  fechaDia,
});
const fechas = (tx: { filas: Dia[] }) =>
  tx.filas.map((f) => f.fecha.toISOString().slice(0, 10)).sort();

describe('presupuestos.repositorio: reemplazarDiasYLineas (HU-50)', () => {
  it('corre la franja entera hacia adelante sin chocar con sus propias fechas', async () => {
    // 30/04, 01/05, 02/05 pasan a 01/05, 02/05, 03/05: cada fila cae sobre la fecha de otra.
    const tx = txConDias([dia(1, '2040-04-30'), dia(2, '2040-05-01'), dia(3, '2040-05-02')]);
    const nuevas = ['2040-05-01', '2040-05-02', '2040-05-03'];

    const ids = await comoPersonal(() =>
      reemplazarDiasYLineas(77, nuevas.map(nuevoDia), nuevas.map(linea), tx as never),
    );

    expect(fechas(tx)).toEqual(nuevas);
    // Cada fila conserva su lugar: la primera sigue siendo la primera.
    expect(ids.get('2040-05-01')).toBe(1);
    expect(ids.get('2040-05-03')).toBe(3);
    expect(tx.eventoDia.create).not.toHaveBeenCalled();
    expect(tx.eventoDia.deleteMany).not.toHaveBeenCalled();
  });

  it('corre la franja entera hacia atrás sin chocar', async () => {
    const tx = txConDias([dia(1, '2040-05-01'), dia(2, '2040-05-02'), dia(3, '2040-05-03')]);
    const nuevas = ['2040-04-30', '2040-05-01', '2040-05-02'];

    const ids = await comoPersonal(() =>
      reemplazarDiasYLineas(77, nuevas.map(nuevoDia), nuevas.map(linea), tx as never),
    );

    expect(fechas(tx)).toEqual(nuevas);
    expect(ids.get('2040-04-30')).toBe(1);
  });

  it('extiende la franja: los días que siguen se conservan y el nuevo entra aparte', async () => {
    const tx = txConDias([dia(1, '2040-05-01'), dia(2, '2040-05-02')]);
    const nuevas = ['2040-05-01', '2040-05-02', '2040-05-03'];

    const ids = await comoPersonal(() =>
      reemplazarDiasYLineas(77, nuevas.map(nuevoDia), nuevas.map(linea), tx as never),
    );

    expect(fechas(tx)).toEqual(nuevas);
    expect(ids.get('2040-05-01')).toBe(1);
    expect(ids.get('2040-05-02')).toBe(2);
    expect(ids.get('2040-05-03')).toBe(900);
  });

  it('achica la franja: saca los días que quedan afuera, en cualquiera de los dos extremos', async () => {
    const tx = txConDias([dia(1, '2040-05-01'), dia(2, '2040-05-02'), dia(3, '2040-05-03')]);
    const nuevas = ['2040-05-02'];

    const ids = await comoPersonal(() =>
      reemplazarDiasYLineas(77, nuevas.map(nuevoDia), nuevas.map(linea), tx as never),
    );

    expect(fechas(tx)).toEqual(nuevas);
    expect(ids.get('2040-05-02')).toBe(2);
    expect(tx.eventoDia.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [1, 3] } } });
  });

  it('las líneas se borran antes que los días (LineaPresupuesto.diaId es Restrict) y se guardan en el día de su fecha', async () => {
    const tx = txConDias([dia(1, '2040-05-01'), dia(2, '2040-05-02')]);
    // Sale el 01/05 y entran el 03/05 y el 04/05: la franja no se corrió, cambió de extremos.
    const nuevas = ['2040-05-02', '2040-05-03', '2040-05-04'];

    await comoPersonal(() =>
      reemplazarDiasYLineas(77, nuevas.map(nuevoDia), nuevas.map(linea), tx as never),
    );

    expect(tx.lineaPresupuesto.deleteMany.mock.invocationCallOrder[0]!).toBeLessThan(
      tx.eventoDia.deleteMany.mock.invocationCallOrder[0]!,
    );
    const guardadas = tx.lineaPresupuesto.createMany.mock.calls[0]![0] as {
      data: { diaId: number; presupuestoId: number; fechaDia?: string }[];
    };
    // Una línea por día, cada una en el id de su día, y sin la `fechaDia` que no es una columna.
    expect(guardadas.data.map((l) => l.diaId)).toEqual([2, 900, 901]);
    expect(guardadas.data.every((l) => l.presupuestoId === 77 && !('fechaDia' in l))).toBe(true);
  });

  it('una línea de un día que no está en la franja es un error, no una línea suelta', async () => {
    const tx = txConDias([dia(1, '2040-05-01')]);

    await expect(
      comoPersonal(() =>
        reemplazarDiasYLineas(77, [nuevoDia('2040-05-01')], [linea('2040-05-09')], tx as never),
      ),
    ).rejects.toThrow('no está en la franja');
  });

  it('deja en la auditoría las fechas de antes y de después cuando la franja cambia', async () => {
    const tx = txConDias([dia(1, '2040-05-01')]);
    const nuevas = ['2040-05-01', '2040-05-02'];

    await comoPersonal(() =>
      reemplazarDiasYLineas(77, nuevas.map(nuevoDia), nuevas.map(linea), tx as never),
    );

    const registros = tx.auditLog.create.mock.calls.map(
      (c) => (c[0] as { data: Record<string, unknown> }).data,
    );
    const delEvento = registros.find((r) => r.entidad === 'Evento');
    expect(delEvento).toBeDefined();
    expect(JSON.stringify(delEvento)).toContain('2040-05-02');
  });
});

describe('presupuestos.repositorio: crearDiasDelEvento (HU-50)', () => {
  it('suma los días que siguen al primero y devuelve todos los del evento, en orden', async () => {
    const tx = txConDias([dia(1, '2040-05-01')]);

    const todos = await crearDiasDelEvento(
      20,
      [nuevoDia('2040-05-02'), nuevoDia('2040-05-03')],
      tx as never,
    );

    expect(tx.eventoDia.create).toHaveBeenCalledTimes(2);
    expect(todos.map((d) => d.fecha.toISOString().slice(0, 10))).toEqual([
      '2040-05-01',
      '2040-05-02',
      '2040-05-03',
    ]);
  });
});
