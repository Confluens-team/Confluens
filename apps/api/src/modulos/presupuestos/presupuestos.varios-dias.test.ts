import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { esquemaCrearConsultaSocial, esquemaCrearPresupuesto } from '@confluens/shared';

import { Prisma } from '../../generated/prisma/client.js';
import {
  generarPresupuesto,
  listarPresupuestos,
  modificarPresupuesto,
  registrarConsultaSocial,
  reutilizarConfiguracion,
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

describe('listarPresupuestos con un salón que se usa varios días (HU-50)', () => {
  it('cuenta el salón una sola vez y trae hasta cuándo dura el evento', async () => {
    const fila = (salonId: number, nombre: string) => ({ salon: { id: salonId, nombre } });
    const repo = {
      obtenerPresupuestos: vi.fn(() =>
        Promise.resolve([
          {
            id: 83,
            eventoId: 99,
            estado: 'Estimado',
            fechaEmision: new Date('2040-03-01T00:00:00.000Z'),
            venceEn: new Date('2040-03-11T00:00:00.000Z'),
            total: D('500'),
            avisoRecepcionEn: null,
            envioFormalEn: null,
            evento: {
              fecha: new Date('2040-04-30'),
              fechaFin: new Date('2040-05-02'),
              tipo: 'Corporativo',
              tipoSocial: null,
              tipoSocialDetalle: null,
              // Un renglón por día: Paraná los tres días y Pucará solo uno.
              salones: [fila(5, 'Paraná'), fila(5, 'Paraná'), fila(5, 'Paraná'), fila(6, 'Pucará')],
              cliente: { id: 1, nombre: 'Ana', apellido: null, correo: 'a@a.com', etiqueta: null },
            },
          },
        ]),
      ),
    };

    const [consulta] = await listarPresupuestos({} as never, comoRepo(repo));

    expect(consulta!.salones.map((s) => s.nombre)).toEqual(['Paraná', 'Pucará']);
    expect([consulta!.fechaEvento, consulta!.fechaFinEvento]).toEqual(['2040-04-30', '2040-05-02']);
  });
});

describe('reutilizarConfiguracion de un evento de varios días (HU-50)', () => {
  // Un evento cobrado de tres días: Paraná el 1.º con 60 personas (completa), Paraná y Pucará el 2.º con
  // 30 (media) y Pucará el 3.º con 80 (completa). El coffee (por persona) va el 1.º y el 3.º.
  const salonConArmado = (s: typeof parana, activo = true) => ({
    salonId: s.id,
    salon: s,
    distribucionId: 14,
    distribucion: { activo },
  });
  const diasOriginales = [
    {
      id: 100,
      fecha: new Date('2040-04-30'),
      cantidadPersonas: 60,
      tipoJornada: 'completa',
      salones: [salonConArmado(parana)],
    },
    {
      id: 101,
      fecha: new Date('2040-05-01'),
      cantidadPersonas: 30,
      tipoJornada: 'media',
      salones: [salonConArmado(parana), salonConArmado(pucara, false)],
    },
    {
      id: 102,
      fecha: new Date('2040-05-02'),
      cantidadPersonas: 80,
      tipoJornada: 'completa',
      salones: [salonConArmado(pucara)],
    },
  ];
  const lineaCoffee = (id: number, diaId: number) => ({
    id,
    diaId,
    servicioId: 1,
    salonId: null,
    descripcion: 'Coffee Refresh',
    cantidad: 1,
    modalidad: 'Normal',
    precioBase: null,
    precioUnitario: D('1000'),
    subtotal: D('1000'),
    aCotizar: false,
    horaEstimada: null,
    servicio: coffee,
  });
  const original = () => ({
    id: 20,
    clienteId: 10,
    estado: 'Cobrado',
    tipo: 'Corporativo',
    tipoSocial: null,
    tipoSocialDetalle: null,
    fecha: new Date('2040-04-30'),
    fechaFin: new Date('2040-05-02'),
    salones: diasOriginales.flatMap((d) => d.salones),
    dias: diasOriginales,
    presupuestos: [
      {
        id: 7,
        estado: 'Confirmado',
        lineas: [lineaCoffee(1, 100), lineaCoffee(2, 102)],
      },
    ],
  });

  function repo(porcentaje = '0', ocupados: object[] = []) {
    return {
      ...repoDeMentira(porcentaje),
      buscarEventoParaReutilizar: vi.fn(() => Promise.resolve(original())),
      buscarSalonesOcupadosPorDia: vi.fn(() => Promise.resolve(ocupados)),
      buscarPresupuestoDetallado: vi.fn(() => Promise.reject(new Error('fin del test'))),
      crearDiasDelEvento: vi.fn((_id: number, dias: { fecha: Date }[]) =>
        Promise.resolve(
          [{ fecha: new Date('2040-09-10') }, ...dias].map((d, i) => ({
            id: 500 + i,
            fecha: d.fecha,
          })),
        ),
      ),
    };
  }
  const pedir = (r: ReturnType<typeof repo>, datos: object = { fecha: '2040-09-10' }) =>
    reutilizarConfiguracion(1, datos as never, comoRepo(r)).catch((e: unknown) => e);

  it('copia la misma franja, desde el día que elige el cliente, con lo de cada día', async () => {
    const r = repo();
    await pedir(r);

    const [dias] = r.crearDiasDelEvento.mock.calls[0]!.slice(1) as [
      { fecha: Date; cantidadPersonas: number; tipoJornada: string }[],
    ];
    expect(
      dias.map((d) => [d.fecha.toISOString().slice(0, 10), d.cantidadPersonas, d.tipoJornada]),
    ).toEqual([
      ['2040-09-11', 30, 'media'],
      ['2040-09-12', 80, 'completa'],
    ]);
    expect(r.crearEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        fecha: new Date('2040-09-10'),
        cantidadPersonas: 60,
        tipoJornada: 'completa',
      }),
      undefined,
    );
    const salonesPorDia = r.reemplazarSalonesDelEvento.mock.calls.map((c) => [
      (c as unknown[])[1],
      (c as unknown[])[4],
    ]);
    expect(salonesPorDia).toEqual([
      [[5], 500],
      [[5, 6], 501],
      [[6], 502],
    ]);
    // Una distribución dada de baja no se copia: Pucará el día 2 queda sin armado.
    const distribuciones = r.reemplazarSalonesDelEvento.mock.calls.map((c) => [
      ...((c as unknown[])[3] as Map<number, number>),
    ]);
    expect(distribuciones).toEqual([[[5, 14]], [[5, 14]], [[6, 14]]]);
  });

  it('los servicios por persona toman las personas de SU día y los precios van por día', async () => {
    const r = repo();
    await pedir(r);

    const { lineas } = lineasGuardadas(r as never) as unknown as {
      lineas: { diaId: number; descripcion: string; cantidad: number; precioUnitario: string }[];
    };
    expect(lineas.map((l) => [l.diaId, l.descripcion, l.cantidad])).toEqual([
      [500, 'Salón Paraná (jornada completa)', 1],
      [500, 'Coffee Refresh', 60],
      [501, 'Salón Paraná (media jornada)', 1],
      [501, 'Salón Pucará (media jornada)', 1],
      [502, 'Salón Pucará (jornada completa)', 1],
      [502, 'Coffee Refresh', 80],
    ]);
  });

  it('proyecta los precios al último día de la franja nueva', async () => {
    // Hoy es marzo de 2040: el último día cae en septiembre (6 meses), no el primero.
    const r = repo('10');
    await pedir(r);

    const { lineas } = lineasGuardadas(r as never) as unknown as {
      lineas: { precioUnitario: string }[];
    };
    // 100000 * 1,1 ^ 6
    expect(lineas[0]!.precioUnitario).toBe('177156.10');
  });

  it('avisa los salones que algún día ya tienen reservados, sin bloquear', async () => {
    const r = repo('0', [
      { fecha: '2040-09-11', salon: pucara, evento: { id: 52 } },
      { fecha: '2040-09-12', salon: pucara, evento: { id: 52 } },
    ]);
    const resultado = (await pedir(r)) as unknown;

    // La consulta se crea igual; se corta recién al releerla en este test.
    expect(r.crearPresupuestoConLineas).toHaveBeenCalledTimes(1);
    expect(String(resultado)).toContain('fin del test');
    expect(r.buscarSalonesOcupadosPorDia).toHaveBeenCalledWith({
      eventoId: 0,
      dias: [
        { fecha: '2040-09-10', salonIds: [5] },
        { fecha: '2040-09-11', salonIds: [5, 6] },
        { fecha: '2040-09-12', salonIds: [6] },
      ],
    });
  });

  it('la fecha tiene que ser futura y las personas y la jornada sueltas se ignoran', async () => {
    const r = repo();
    await expect(pedir(r, { fecha: '2040-03-10' })).resolves.toMatchObject({ status: 400 });

    await pedir(r, { fecha: '2040-09-10', cantidadPersonas: 5, tipoJornada: 'media' });
    expect(r.crearEvento).toHaveBeenCalledWith(
      expect.objectContaining({ cantidadPersonas: 60, tipoJornada: 'completa' }),
      undefined,
    );
  });
});

describe('modificarPresupuesto de un evento ya reservado, día por día (HU-50, RN-09)', () => {
  // 12:00Z a 21:00Z son las 09:00 a 18:00 en Córdoba.
  const horario = (fecha: string) => ({
    inicio: new Date(`${fecha}T12:00:00.000Z`),
    fin: new Date(`${fecha}T21:00:00.000Z`),
  });

  // Un evento Reservado con un renglón de Paraná por día, con su armado (14) y 90.000 congelados.
  function reservado(fechas: string[]) {
    const dias = fechas.map((fecha, i) => ({
      id: 500 + i,
      eventoId: 99,
      fecha: new Date(fecha),
      ...horario(fecha),
      tipoJornada: 'completa',
      cantidadPersonas: 50,
      salones: [{ salonId: 5, salon: parana, distribucion: { id: 14 }, distribucionId: 14 }],
    }));
    return {
      id: 77,
      eventoId: 99,
      estado: 'Confirmado',
      fechaEmision: new Date('2040-03-01T00:00:00.000Z'),
      venceEn: new Date('2040-03-11T00:00:00.000Z'),
      total: D('100000'),
      requiereFactura: false,
      avisoRecepcionEn: null,
      envioFormalEn: null,
      evento: {
        id: 99,
        estado: 'Reservado',
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
        inicio: dias[0]!.inicio,
        fin: dias[dias.length - 1]!.fin,
        cliente: { id: 10, nombre: 'Ana', apellido: null, correo: 'a@a.com', telefono: '1' },
        salones: dias.flatMap((d) => d.salones),
        dias,
      },
      lineas: dias.map((dia, i) => ({
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
    };
  }

  function repoReservado(fechas: string[], pagado = '0', choques: object[] = []) {
    const presupuesto = reservado(fechas);
    return {
      ...repoDeMentira(),
      buscarPresupuestoDetallado: vi.fn(() => Promise.resolve(presupuesto)),
      buscarChoquesPorDia: vi.fn(() => Promise.resolve(choques)),
      buscarDistribucionPorNombre: vi.fn(() => Promise.resolve(null)),
      sumarPagos: vi.fn(() => Promise.resolve(new Prisma.Decimal(pagado))),
      reemplazarDiasYLineas: vi.fn(() => Promise.resolve(new Map())),
      actualizarEvento: vi.fn((_id: number, _datos: Record<string, unknown>, _tx?: unknown) =>
        Promise.resolve({}),
      ),
      actualizarPresupuesto: vi.fn((_id: number, _datos: Record<string, unknown>, _tx?: unknown) =>
        Promise.resolve({}),
      ),
    };
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
  const guardado = (r: ReturnType<typeof repoReservado>) =>
    r.reemplazarDiasYLineas.mock.calls[0] as unknown as [
      number,
      {
        fecha: Date;
        inicio: Date;
        fin: Date;
        salones: { salonId: number; distribucionId: number | null }[];
      }[],
    ];
  const hora = (d: Date) => d.toISOString().slice(0, 16);

  it('extiende un evento de un día: los días nuevos entran con el horario del vecino y el armado del salón', async () => {
    const r = repoReservado(['2040-04-30']);
    await modificarPresupuesto(
      77,
      { dias: [dia('2040-04-30'), dia('2040-05-01'), dia('2040-05-02')] } as never,
      comoRepo(r),
    ).catch(() => undefined);

    const [, dias] = guardado(r);
    expect(dias.map((d) => [iso(d.fecha), hora(d.inicio), hora(d.fin)])).toEqual([
      ['2040-04-30', '2040-04-30T12:00', '2040-04-30T21:00'],
      ['2040-05-01', '2040-05-01T12:00', '2040-05-01T21:00'],
      ['2040-05-02', '2040-05-02T12:00', '2040-05-02T21:00'],
    ]);
    // El salón ya tenía armado: lo conserva en los días nuevos.
    expect(dias.every((d) => d.salones[0]!.distribucionId === 14)).toBe(true);
  });

  it('corre la franja entera: cada día lleva su horario a la fecha nueva', async () => {
    const r = repoReservado(['2040-04-30', '2040-05-01']);
    await modificarPresupuesto(
      77,
      { dias: [dia('2040-05-02'), dia('2040-05-03')] } as never,
      comoRepo(r),
    ).catch(() => undefined);

    const [, dias] = guardado(r);
    expect(dias.map((d) => [iso(d.fecha), hora(d.inicio)])).toEqual([
      ['2040-05-02', '2040-05-02T12:00'],
      ['2040-05-03', '2040-05-03T12:00'],
    ]);
  });

  it('si algún día choca con otro evento no escribe nada y avisa de todos los choques', async () => {
    const choque = {
      fecha: '2040-05-01',
      salon: parana,
      evento: {
        id: 52,
        estado: 'Reservado',
        cliente: 'Constructora Medina SRL',
        inicio: '2040-05-01T12:00:00.000Z',
        fin: '2040-05-01T21:00:00.000Z',
      },
    };
    const r = repoReservado(['2040-04-30'], '0', [choque]);

    const error = await modificarPresupuesto(
      77,
      { dias: [dia('2040-04-30'), dia('2040-05-01')] } as never,
      comoRepo(r),
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 409 });
    expect((error as Error).message).toContain('No se puede modificar el evento');
    expect((error as Error).message).toContain('Salón Paraná: reservado por el evento #52');
    expect(r.reemplazarDiasYLineas).not.toHaveBeenCalled();
    expect(r.actualizarPresupuesto).not.toHaveBeenCalled();
  });

  it('un evento reservado necesita salón cada día', async () => {
    const r = repoReservado(['2040-04-30']);

    await expect(
      modificarPresupuesto(
        77,
        { dias: [dia('2040-04-30'), dia('2040-05-01', { salones: [] })] } as never,
        comoRepo(r),
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(r.reemplazarDiasYLineas).not.toHaveBeenCalled();
  });

  it('sigue Confirmado y el estado sale de lo pagado contra el total nuevo', async () => {
    // Pagó 190.000. Con dos días a 100.000 cada uno (200.000) todavía debe: Reservado.
    const debe = repoReservado(['2040-04-30'], '190000');
    await modificarPresupuesto(
      77,
      { dias: [dia('2040-04-30'), dia('2040-05-01')] } as never,
      comoRepo(debe),
    ).catch(() => undefined);
    expect(debe.actualizarEvento.mock.calls[0]![1]).toMatchObject({ estado: 'Reservado' });
    // Sin tocar el estado del presupuesto: sigue Confirmado, pero se vuelve a emitir.
    const cambios = debe.actualizarPresupuesto.mock.calls[0]![1] as Record<string, unknown>;
    expect(cambios).not.toHaveProperty('estado');
    expect(cambios).toMatchObject({ total: '200000.00' });

    // Pagó todo: con el mismo total queda Cobrado.
    const pagado = repoReservado(['2040-04-30'], '200000');
    await modificarPresupuesto(
      77,
      { dias: [dia('2040-04-30'), dia('2040-05-01')] } as never,
      comoRepo(pagado),
    ).catch(() => undefined);
    expect(pagado.actualizarEvento.mock.calls[0]![1]).toMatchObject({ estado: 'Cobrado' });
  });
});
