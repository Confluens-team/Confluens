import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { esquemaCrearConsultaSocial, esquemaCrearPresupuesto } from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import { ErrorApi } from '../../lib/errores.js';
import {
  generarPresupuesto,
  modificarPresupuesto,
  registrarConsultaSocial,
} from './presupuestos.servicio.js';
import type { PresupuestosRepositorio } from './presupuestos.repositorio.js';

// HU-50, parte 2: el cotizador y el presupuesto por día. Se prueba el servicio contra un repositorio
// de mentira (como el resto del módulo): lo que importa es qué se le pide guardar, día por día.

const D = (valor: string) => new Prisma.Decimal(valor);

const salon = (id: number, nombre: string, completa: string, media: string) => ({
  id,
  nombre,
  capacidadMaxima: 200,
  precioJornadaCompleta: D(completa),
  precioMediaJornada: D(media),
});
const parana = salon(5, 'Paraná', '100000', '60000');
const pucara = salon(6, 'Pucará', '200000', '120000');

const coffee = {
  id: 1,
  nombre: 'Coffee Refresh',
  precio: D('1000'),
  porPersona: true,
  tercerizado: false,
  admiteModalidad: false,
  activo: true,
};

const iso = (fecha: Date) => fecha.toISOString().slice(0, 10);

function repoDeMentira(porcentaje = '0') {
  return {
    buscarClientePorCorreo: vi.fn(() => Promise.resolve({ id: 10 })),
    buscarClientePorUsuarioId: vi.fn(() =>
      Promise.resolve({ id: 10, nombre: 'Ana', correo: 'ana@example.com', telefono: '351' }),
    ),
    crearCliente: vi.fn(),
    buscarSalonesPorIds: vi.fn((ids: number[]) =>
      Promise.resolve([parana, pucara].filter((s) => ids.includes(s.id))),
    ),
    buscarServiciosPorIds: vi.fn((ids: number[]) =>
      Promise.resolve([coffee].filter((s) => ids.includes(s.id))),
    ),
    buscarSolicitud: vi.fn(),
    vincularSolicitudAEvento: vi.fn(),
    crearEvento: vi.fn(() => Promise.resolve({ id: 99 })),
    crearDiasDelEvento: vi.fn((_eventoId: number, dias: { fecha: Date }[]) =>
      // El primer día lo creó crearEvento; el repositorio devuelve todos, en orden.
      Promise.resolve(
        [{ id: 500, fecha: new Date('2040-04-30') }, ...dias].map((d, i) => ({
          id: 500 + i,
          fecha: d.fecha,
        })),
      ),
    ),
    reemplazarSalonesDelEvento: vi.fn(() => Promise.resolve()),
    crearPresupuestoConLineas: vi.fn(() => Promise.resolve({ id: 77 })),
    crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
    obtenerPorcentajeMensual: vi.fn(() => Promise.resolve(porcentaje)),
  };
}

type Mentira = ReturnType<typeof repoDeMentira>;
const comoRepo = (repo: object) => repo as unknown as PresupuestosRepositorio;

// Los pedidos pasan por el esquema real, como en la ruta: así llegan con sus valores por defecto.
const crear = (datos: object) => esquemaCrearPresupuesto.parse(datos);
const social = (datos: object) => esquemaCrearConsultaSocial.parse(datos);

const contacto = { nombre: 'Ana', telefono: '351', correo: 'ana@example.com' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2040-03-10T15:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

function lineasGuardadas(repo: Mentira) {
  const llamada = repo.crearPresupuestoConLineas.mock.calls[0] as unknown as [
    { lineas: Record<string, unknown>[]; total: string },
  ];
  return llamada[0];
}

describe('generarPresupuesto con varios días (HU-50)', () => {
  const dias = [
    { fecha: '2040-04-30', cantidadPersonas: 100, tipoJornada: 'completa' as const, salonIds: [5] },
    {
      fecha: '2040-05-01',
      cantidadPersonas: 50,
      tipoJornada: 'media' as const,
      salonIds: [5, 6],
      servicios: [{ servicioId: 1, cantidad: 50 }],
    },
    { fecha: '2040-05-02', cantidadPersonas: 80, tipoJornada: 'completa' as const, salonIds: [6] },
  ];

  it('crea el evento con su primer día, suma los demás y le cuelga a cada uno sus salones y líneas', async () => {
    const repo = repoDeMentira();
    await generarPresupuesto(crear({ ...contacto, dias }), comoRepo(repo));

    expect(repo.crearEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        fecha: new Date('2040-04-30'),
        cantidadPersonas: 100,
        tipoJornada: 'completa',
      }),
      undefined,
    );
    const [, diasNuevos] = repo.crearDiasDelEvento.mock.calls[0]!;
    expect(diasNuevos).toEqual([
      { fecha: new Date('2040-05-01'), cantidadPersonas: 50, tipoJornada: 'media' },
      { fecha: new Date('2040-05-02'), cantidadPersonas: 80, tipoJornada: 'completa' },
    ]);
    // Cada día con SUS salones y el id de SU día.
    const salonesPorDia = repo.reemplazarSalonesDelEvento.mock.calls.map(
      (c) => [(c as unknown[])[1], (c as unknown[])[4]] as const,
    );
    expect(salonesPorDia).toEqual([
      [[5], 500],
      [[5, 6], 501],
      [[6], 502],
    ]);
    const { lineas } = lineasGuardadas(repo);
    expect(lineas.map((l) => [l.diaId, l.descripcion])).toEqual([
      [500, 'Salón Paraná (jornada completa)'],
      [501, 'Salón Paraná (media jornada)'],
      [501, 'Salón Pucará (media jornada)'],
      [501, 'Coffee Refresh'],
      [502, 'Salón Pucará (jornada completa)'],
    ]);
  });

  it('el precio del salón es el de la jornada de cada día y hay un solo total', async () => {
    const repo = repoDeMentira();
    await generarPresupuesto(crear({ ...contacto, dias }), comoRepo(repo));

    const { lineas, total } = lineasGuardadas(repo);
    expect(lineas.map((l) => l.subtotal)).toEqual([
      '100000.00', // Paraná completa
      '60000.00', // Paraná media
      '120000.00', // Pucará media
      '50000.00', // coffee: 50 personas ese día
      '200000.00', // Pucará completa
    ]);
    expect(total).toBe('530000.00');
  });

  it('proyecta los precios a la fecha del ÚLTIMO día, no a la del primero', async () => {
    // Hoy es marzo. El primer día cae en abril (1 mes) y el último en mayo (2 meses).
    const repo = repoDeMentira('10');
    await generarPresupuesto(crear({ ...contacto, dias }), comoRepo(repo));

    const { lineas } = lineasGuardadas(repo);
    // 100000 * 1,1 * 1,1 = 121000 (dos meses), no 110000 (uno).
    expect(lineas[0]!.precioUnitario).toBe('121000.00');
  });

  it('controla la cantidad de cada servicio contra las personas de SU día', async () => {
    const repo = repoDeMentira();
    // 60 personas en el coffee del día 2, que tiene 50 (aunque el día 1 tiene 100).
    const conExceso = dias.map((dia, i) =>
      i === 1 ? { ...dia, servicios: [{ servicioId: 1, cantidad: 60 }] } : dia,
    );

    await expect(
      generarPresupuesto(crear({ ...contacto, dias: conExceso }), comoRepo(repo)),
    ).rejects.toMatchObject({ status: 422 });
    expect(repo.crearEvento).not.toHaveBeenCalled();
  });

  it('un salón que no existe en cualquiera de los días falla antes de escribir nada', async () => {
    const repo = repoDeMentira();
    const conSalonInexistente = dias.map((dia, i) => (i === 2 ? { ...dia, salonIds: [999] } : dia));

    await expect(
      generarPresupuesto(crear({ ...contacto, dias: conSalonInexistente }), comoRepo(repo)),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.crearEvento).not.toHaveBeenCalled();
  });

  it('un evento de un solo día no crea días de más ni cambia la forma de guardar', async () => {
    const repo = repoDeMentira();
    await generarPresupuesto(crear({ ...contacto, ...dias[0] }), comoRepo(repo));

    expect(repo.crearDiasDelEvento).not.toHaveBeenCalled();
    expect(repo.reemplazarSalonesDelEvento).toHaveBeenCalledWith(99, [5], undefined);
    const { lineas } = lineasGuardadas(repo);
    expect(lineas.every((l) => l.diaId === undefined)).toBe(true);
  });
});

describe('registrarConsultaSocial con franja (HU-50)', () => {
  const base = {
    fecha: '2040-04-29',
    cantidadPersonas: 80,
    tipoJornada: 'completa' as const,
    tipoSocial: 'Casamiento' as const,
    horaInicioEstimada: '20:00',
  };

  it('crea un día vacío por cada fecha de la franja, con las personas y la jornada pedidas', async () => {
    const repo = repoDeMentira();
    await registrarConsultaSocial(3, social({ ...base, fechaFin: '2040-05-01' }), comoRepo(repo));

    const [eventoId, diasNuevos] = repo.crearDiasDelEvento.mock.calls[0]!;
    expect(eventoId).toBe(99);
    expect(diasNuevos).toEqual([
      { fecha: new Date('2040-04-30'), cantidadPersonas: 80, tipoJornada: 'completa' },
      { fecha: new Date('2040-05-01'), cantidadPersonas: 80, tipoJornada: 'completa' },
    ]);
    // Sin salones ni servicios: el presupuesto nace vacío y sin armar (ADR 0008).
    expect(lineasGuardadas(repo)).toMatchObject({ lineas: [], total: '0.00' });
  });

  it('sin fecha de fin, o con el mismo día, dura un solo día', async () => {
    for (const fechaFin of [undefined, '2040-04-29']) {
      const repo = repoDeMentira();
      await registrarConsultaSocial(3, social({ ...base, fechaFin }), comoRepo(repo));
      expect(repo.crearDiasDelEvento).not.toHaveBeenCalled();
    }
  });
});

describe('modificarPresupuesto con varios días (HU-50)', () => {
  // Un presupuesto Estimado de un evento EnConsulta con los días que se indiquen. Cada día lleva
  // un salón a 100.000 congelado (un precio que el catálogo ya no tiene).
  function presupuestoConDias(fechas: string[], extra: Record<string, unknown> = {}) {
    const diasGuardados = fechas.map((fecha, i) => ({
      id: 500 + i,
      eventoId: 99,
      fecha: new Date(fecha),
      inicio: null,
      fin: null,
      tipoJornada: 'completa',
      cantidadPersonas: 50,
      salones: [{ salon: parana, distribucion: null }],
    }));
    return {
      id: 77,
      eventoId: 99,
      estado: 'Estimado',
      fechaEmision: new Date('2040-03-01T00:00:00.000Z'),
      venceEn: new Date('2040-03-11T00:00:00.000Z'),
      total: D('0'),
      requiereFactura: true,
      avisoRecepcionEn: null,
      envioFormalEn: null,
      evento: {
        id: 99,
        estado: 'EnConsulta',
        fecha: new Date(fechas[0]!),
        fechaFin: new Date(fechas[fechas.length - 1]!),
        cantidadPersonas: 50,
        tipo: 'Corporativo',
        tipoSocial: null,
        tipoSocialDetalle: null,
        tipoJornada: 'completa',
        horaInicioEstimada: null,
        horaFinEstimada: null,
        observacionesComanda: null,
        inicio: null,
        fin: null,
        cliente: { id: 10, nombre: 'Ana', apellido: null, correo: 'a@a.com', telefono: '1' },
        salones: [{ salonId: 5, salon: parana, distribucion: null, distribucionId: null }],
        dias: diasGuardados,
      },
      lineas: diasGuardados.map((dia, i) => ({
        id: i + 1,
        diaId: dia.id,
        presupuestoId: 77,
        servicioId: null,
        salonId: 5,
        descripcion: 'Salón Paraná (jornada completa)',
        cantidad: 1,
        precioUnitario: D('90000'),
        subtotal: D('90000'),
        aCotizar: false,
        modalidad: 'Normal',
        precioBase: null,
        horaEstimada: null,
        servicio: null,
      })),
      ...extra,
    };
  }

  function repoParaModificar(presupuesto: unknown) {
    const repo = {
      ...repoDeMentira(),
      buscarPresupuestoDetallado: vi.fn(() => Promise.resolve(presupuesto)),
      reemplazarDiasYLineas: vi.fn((_id: number, dias: { fecha: Date }[], _lineas?: unknown[]) =>
        Promise.resolve(new Map(dias.map((d, i) => [iso(d.fecha), 700 + i]))),
      ),
      actualizarEvento: vi.fn(() => Promise.resolve({})),
      actualizarPresupuesto: vi.fn(() => Promise.resolve({})),
    };
    return repo;
  }

  const dia = (fecha: string, extra: Record<string, unknown> = {}) => ({
    fecha,
    cantidadPersonas: 50,
    tipoJornada: 'completa' as const,
    salones: [{ salonId: 5 }],
    servicios: [],
    adicionales: [],
    ...extra,
  });

  it('extiende la franja: los días nuevos entran con lo que traen y todo se reprecia al último día', async () => {
    // El evento dura dos días y pasa a durar tres, así que el último día cambia (de 01/05 a 02/05).
    const repo = repoParaModificar(presupuestoConDias(['2040-04-30', '2040-05-01']));
    await modificarPresupuesto(
      77,
      {
        dias: [
          dia('2040-04-30'),
          dia('2040-05-01'),
          dia('2040-05-02', { salones: [{ salonId: 6 }] }),
        ],
      } as never,
      comoRepo(repo),
    );

    const [id, dias, lineas] = repo.reemplazarDiasYLineas.mock.calls[0] as unknown as [
      number,
      { fecha: Date }[],
      { fechaDia: string; descripcion: string; precioUnitario: string }[],
    ];
    expect(id).toBe(77);
    expect(dias.map((d) => iso(d.fecha))).toEqual(['2040-04-30', '2040-05-01', '2040-05-02']);
    expect(lineas.map((l) => [l.fechaDia, l.descripcion])).toEqual([
      ['2040-04-30', 'Salón Paraná (jornada completa)'],
      ['2040-05-01', 'Salón Paraná (jornada completa)'],
      ['2040-05-02', 'Salón Pucará (jornada completa)'],
    ]);
    // Cambió el último día: los salones que ya estaban toman el precio vigente (100000) y no el
    // congelado (90000), también en los días que ya existían.
    expect(lineas.map((l) => l.precioUnitario)).toEqual(['100000.00', '100000.00', '200000.00']);
    // Cada día recibe sus salones, con el id de ese día.
    const salonesPorDia = repo.reemplazarSalonesDelEvento.mock.calls.map(
      (c) => [(c as unknown[])[1], (c as unknown[])[4]] as const,
    );
    expect(salonesPorDia).toEqual([
      [[5], 700],
      [[5], 701],
      [[6], 702],
    ]);
    expect(repo.actualizarPresupuesto).toHaveBeenCalledWith(
      77,
      expect.objectContaining({ estado: 'Estimado', total: '400000.00' }),
      undefined,
    );
  });

  it('si el último día no cambia, los días que quedan conservan su precio congelado', async () => {
    // Se saca el primer día: la franja pasa de 30/04-02/05 a 01/05-02/05 y la referencia (02/05) sigue.
    const repo = repoParaModificar(presupuestoConDias(['2040-04-30', '2040-05-01', '2040-05-02']));
    await modificarPresupuesto(
      77,
      { dias: [dia('2040-05-01'), dia('2040-05-02')] } as never,
      comoRepo(repo),
    );

    const lineas = repo.reemplazarDiasYLineas.mock.calls[0]![2] as unknown as {
      precioUnitario: string;
    }[];
    expect(lineas.map((l) => l.precioUnitario)).toEqual(['90000.00', '90000.00']);
  });

  it('un servicio de un día se controla contra las personas de ese día', async () => {
    const repo = repoParaModificar(presupuestoConDias(['2040-04-30', '2040-05-01']));
    const cantidadDeMas = {
      dias: [
        dia('2040-04-30'),
        dia('2040-05-01', { cantidadPersonas: 20, servicios: [{ servicioId: 1, cantidad: 30 }] }),
      ],
    };

    await expect(
      modificarPresupuesto(77, cantidadDeMas as never, comoRepo(repo)),
    ).rejects.toMatchObject({ status: 422 });
    expect(repo.reemplazarDiasYLineas).not.toHaveBeenCalled();
  });

  it('un corporativo necesita salón en cada día', async () => {
    const repo = repoParaModificar(presupuestoConDias(['2040-04-30', '2040-05-01']));

    await expect(
      modificarPresupuesto(
        77,
        { dias: [dia('2040-04-30'), dia('2040-05-01', { salones: [] })] } as never,
        comoRepo(repo),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('un pedido de un solo día con los campos sueltos no achica un evento de varios días', async () => {
    const repo = repoParaModificar(presupuestoConDias(['2040-04-30', '2040-05-01']));

    await expect(
      modificarPresupuesto(77, { ...dia('2040-04-30') } as never, comoRepo(repo)),
    ).rejects.toMatchObject({ status: 422 });
    expect(repo.reemplazarDiasYLineas).not.toHaveBeenCalled();
  });

  it('un evento ya reservado no puede pasar a durar varios días todavía', async () => {
    const base = presupuestoConDias(['2040-04-30']);
    const reservado = {
      ...base,
      estado: 'Confirmado',
      evento: { ...base.evento, estado: 'Reservado' },
    };
    const repo = repoParaModificar(reservado);

    await expect(
      modificarPresupuesto(
        77,
        { dias: [dia('2040-04-30'), dia('2040-05-01')] } as never,
        comoRepo(repo),
      ),
    ).rejects.toBeInstanceOf(ErrorApi);
    expect(repo.reemplazarDiasYLineas).not.toHaveBeenCalled();
  });

  it('un evento de un solo día que sigue siendo de uno no usa el camino por días', async () => {
    const repo = {
      ...repoParaModificar(presupuestoConDias(['2040-04-30'])),
      quitarSalonesDelEvento: vi.fn(() => Promise.resolve()),
      reemplazarLineas: vi.fn(() => Promise.resolve()),
      sumarPagos: vi.fn(),
      buscarDistribucionPorNombre: vi.fn(),
    };
    await modificarPresupuesto(77, { ...dia('2040-04-30') } as never, comoRepo(repo));

    expect(repo.reemplazarDiasYLineas).not.toHaveBeenCalled();
    expect(repo.reemplazarLineas).toHaveBeenCalledTimes(1);
  });
});
