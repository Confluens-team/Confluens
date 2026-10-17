import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';
import type { LineaNueva } from './presupuestos.repositorio.js';

// HU-24: POST /api/eventos/:id/reutilizar. La consulta nueva la arma el servicio de presupuestos,
// así que se mockea su repositorio, igual que en presupuestos.consultas.test.ts.
vi.mock('./presupuestos.repositorio.js', () => ({
  buscarEventoParaReutilizar: vi.fn(),
  buscarSalonesReservadosEseDia: vi.fn(),
  obtenerPorcentajeMensual: vi.fn(),
  crearEvento: vi.fn(),
  reemplazarSalonesDelEvento: vi.fn(),
  crearPresupuestoConLineas: vi.fn(),
  buscarPresupuestoDetallado: vi.fn(),
  crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
}));

const repo = await import('./presupuestos.repositorio.js');
const buscarEventoMock = vi.mocked(repo.buscarEventoParaReutilizar);
const buscarReservadosMock = vi.mocked(repo.buscarSalonesReservadosEseDia);
const obtenerPorcentajeMock = vi.mocked(repo.obtenerPorcentajeMensual);
const crearEventoMock = vi.mocked(repo.crearEvento);
const reemplazarSalonesMock = vi.mocked(repo.reemplazarSalonesDelEvento);
const crearPresupuestoMock = vi.mocked(repo.crearPresupuestoConLineas);
const buscarDetalladoMock = vi.mocked(repo.buscarPresupuestoDetallado);

const app = crearApp();
const D = (valor: string) => new Prisma.Decimal(valor);

function cookieDe(rol: 'RESPONSABLE_EVENTOS' | 'CLIENTE') {
  return `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email: 'personal@confluens.test', rol })}`;
}
const cookieRE = cookieDe('RESPONSABLE_EVENTOS');

const parana = {
  id: 5,
  nombre: 'Paraná',
  capacidadMaxima: 40,
  superficie: 60,
  precioJornadaCompleta: D('150000'),
  precioMediaJornada: D('110000'),
  visibleEnLanding: true,
  fotoUrl: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

function servicio(
  datos: { id: number; nombre: string; precio: string | null } & Record<string, unknown>,
) {
  return {
    descripcion: '',
    unidadMedida: 'persona',
    porPersona: true,
    tercerizado: false,
    admiteModalidad: false,
    activo: true,
    categoria: null,
    fotoUrl: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...datos,
    precio: datos.precio === null ? null : D(datos.precio),
  };
}

const coffee = servicio({ id: 1, nombre: 'Coffee Refresh', precio: '9000', admiteModalidad: true });
const pantallas = servicio({ id: 2, nombre: 'Pantallas LED', precio: null, tercerizado: true });
const desayunoViejo = servicio({ id: 3, nombre: 'Desayuno viejo', precio: '5000', activo: false });

function linea(datos: Record<string, unknown>) {
  return {
    id: 1,
    presupuestoId: 31,
    servicioId: null,
    salonId: null,
    descripcion: '',
    cantidad: 1,
    precioUnitario: D('0'),
    subtotal: D('0'),
    aCotizar: false,
    modalidad: 'Normal',
    precioBase: null,
    horaEstimada: null,
    servicio: null,
    ...datos,
  };
}

// Un evento Cobrado de 30 personas en Paraná con Banquete: el salón a precio viejo, un coffee
// continuo con precio viejo, unas pantallas a cotizar, un servicio que ya no está y un adicional.
function eventoOriginal(datos: Record<string, unknown> = {}) {
  return {
    id: 20,
    clienteId: 10,
    fecha: new Date('2026-05-10T00:00:00.000Z'),
    inicio: new Date('2026-05-10T12:00:00.000Z'),
    fin: new Date('2026-05-10T20:00:00.000Z'),
    cantidadPersonas: 30,
    estado: 'Cobrado',
    tipo: 'Corporativo',
    tipoSocial: null,
    tipoSocialDetalle: null,
    tipoJornada: 'completa',
    horaInicioEstimada: '09:00',
    modalidadSalonRestaurante: true,
    observacionesComanda: 'Sin TACC',
    salones: [{ eventoId: 20, salonId: 5, distribucionId: 14, salon: parana }],
    presupuestos: [
      {
        id: 31,
        estado: 'Confirmado',
        lineas: [
          linea({
            salonId: 5,
            descripcion: 'Salón Paraná (jornada completa)',
            precioUnitario: D('120000'),
            subtotal: D('120000'),
          }),
          linea({
            servicioId: 1,
            descripcion: 'Coffee Refresh',
            cantidad: 30,
            modalidad: 'Continuo',
            precioBase: D('7000'),
            precioUnitario: D('8400'),
            subtotal: D('252000'),
            horaEstimada: '10:30',
            servicio: coffee,
          }),
          linea({
            servicioId: 2,
            descripcion: 'Pantallas LED',
            aCotizar: true,
            servicio: pantallas,
          }),
          linea({
            servicioId: 3,
            descripcion: 'Desayuno viejo',
            cantidad: 30,
            precioUnitario: D('4000'),
            subtotal: D('120000'),
            servicio: desayunoViejo,
          }),
          linea({
            descripcion: 'Centros de mesa',
            cantidad: 6,
            precioUnitario: D('2500'),
            subtotal: D('15000'),
          }),
        ],
      },
    ],
    ...datos,
  } as never;
}

const lineasGuardadas = () => crearPresupuestoMock.mock.calls[0]![0].lineas as LineaNueva[];
const datosDelPresupuesto = () => crearPresupuestoMock.mock.calls[0]![0];
const datosDelEvento = () => crearEventoMock.mock.calls[0]![0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T15:00:00.000Z'));
  buscarEventoMock.mockResolvedValue(eventoOriginal());
  buscarReservadosMock.mockResolvedValue([]);
  obtenerPorcentajeMock.mockResolvedValue('0');
  crearEventoMock.mockResolvedValue({ id: 99 } as never);
  crearPresupuestoMock.mockResolvedValue({ id: 77 } as never);
  // La respuesta relee la consulta creada; acá alcanza con una consulta mínima.
  buscarDetalladoMock.mockImplementation(async () => {
    const { lineas, total } = datosDelPresupuesto();
    return {
      id: 77,
      eventoId: 99,
      estado: 'Estimado',
      fechaEmision: new Date(),
      venceEn: new Date(),
      total: D(total),
      requiereFactura: false,
      evento: {
        id: 99,
        estado: 'EnConsulta',
        fecha: new Date('2026-12-04T00:00:00.000Z'),
        cantidadPersonas: 30,
        tipo: 'Corporativo',
        tipoSocial: null,
        tipoSocialDetalle: null,
        tipoJornada: 'completa',
        horaInicioEstimada: null,
        observacionesComanda: null,
        inicio: null,
        fin: null,
        cliente: {
          id: 10,
          nombre: 'Marina',
          apellido: null,
          correo: 'marina@example.com',
          telefono: '+5493515551234',
          etiqueta: null,
        },
        salones: [],
      },
      lineas: lineas.map((l, i) => ({
        ...l,
        id: i + 1,
        presupuestoId: 77,
        precioUnitario: D(l.precioUnitario),
        subtotal: D(l.subtotal),
        precioBase: l.precioBase === null ? null : D(l.precioBase),
        servicio: null,
      })),
    } as never;
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const reutilizar = (body: Record<string, unknown> = { fecha: '2026-12-04' }, id = 20) =>
  request(app).post(`/api/eventos/${id}/reutilizar`).set('Cookie', [cookieRE]).send(body);

describe('POST /api/eventos/:id/reutilizar (HU-24)', () => {
  it('crea una consulta nueva para el mismo cliente con la configuración del evento', async () => {
    const respuesta = await reutilizar({ fecha: '2026-12-04', horaInicioEstimada: '08:30' });

    expect(respuesta.status).toBe(201);
    expect(datosDelEvento()).toEqual({
      clienteId: 10,
      fecha: new Date('2026-12-04'),
      cantidadPersonas: 30,
      tipo: 'Corporativo',
      tipoSocial: null,
      tipoSocialDetalle: null,
      tipoJornada: 'completa',
      horaInicioEstimada: '08:30',
    });
    // El salón con la distribución que tenía armada.
    const [eventoId, salonIds, , distribuciones] = reemplazarSalonesMock.mock.calls[0]!;
    expect(eventoId).toBe(99);
    expect(salonIds).toEqual([5]);
    expect(distribuciones).toEqual(new Map([[5, 14]]));
    expect(respuesta.body.data.consulta.id).toBe(77);
  });

  it('toma los precios vigentes del catálogo y conserva la modalidad de cada servicio', async () => {
    await reutilizar();

    const [salon, coffeeNuevo] = lineasGuardadas();
    expect(salon).toMatchObject({ salonId: 5, precioUnitario: '150000.00' });
    // 9000 vigente + 20% del continuo, no los 8400 del original.
    expect(coffeeNuevo).toMatchObject({
      servicioId: 1,
      cantidad: 30,
      modalidad: 'Continuo',
      precioBase: '9000.00',
      precioUnitario: '10800.00',
      subtotal: '324000.00',
      horaEstimada: '10:30',
    });
  });

  it('proyecta los precios a la fecha nueva con el incremento mensual (RN-13)', async () => {
    obtenerPorcentajeMock.mockResolvedValue('10');

    await reutilizar({ fecha: '2026-12-04' });

    const [salon, coffeeNuevo] = lineasGuardadas();
    // Dos meses: × 1.1 × 1.1.
    expect(salon).toMatchObject({ precioUnitario: '181500.00' });
    expect(coffeeNuevo).toMatchObject({ precioBase: '10890.00', precioUnitario: '13068.00' });
  });

  it('copia el tercerizado a cotizar sin importe y el adicional con su precio', async () => {
    await reutilizar();

    const lineas = lineasGuardadas();
    expect(lineas.find((l) => l.servicioId === 2)).toMatchObject({
      aCotizar: true,
      subtotal: '0.00',
    });
    expect(lineas.find((l) => l.descripcion === 'Centros de mesa')).toMatchObject({
      servicioId: null,
      salonId: null,
      cantidad: 6,
      precioUnitario: '2500.00',
      subtotal: '15000.00',
    });
  });

  it('deja afuera los servicios que ya no están en el catálogo y los informa', async () => {
    const respuesta = await reutilizar();

    expect(lineasGuardadas().some((l) => l.servicioId === 3)).toBe(false);
    expect(respuesta.body.data.serviciosOmitidos).toEqual([{ id: 3, nombre: 'Desayuno viejo' }]);
  });

  it('el presupuesto nace con 10 días de vigencia y su total suma las líneas copiadas', async () => {
    await reutilizar();

    const { venceEn, total } = datosDelPresupuesto();
    expect(venceEn).toEqual(new Date('2026-10-26T15:00:00.000Z'));
    // 150000 + 324000 + 0 + 15000
    expect(total).toBe('489000.00');
  });

  it('se puede reutilizar un evento cancelado', async () => {
    buscarEventoMock.mockResolvedValue(
      eventoOriginal({
        estado: 'Cancelado',
        presupuestos: [{ id: 31, estado: 'Cancelado', lineas: [] }],
      }),
    );

    const respuesta = await reutilizar();

    expect(respuesta.status).toBe(201);
  });

  it('avisa los salones que ese día ya tienen un evento reservado, sin bloquear', async () => {
    buscarReservadosMock.mockResolvedValue([{ id: 5, nombre: 'Paraná' }]);

    const respuesta = await reutilizar();

    expect(respuesta.status).toBe(201);
    expect(buscarReservadosMock).toHaveBeenCalledWith([5], new Date('2026-12-04'));
    expect(respuesta.body.data.salonesEnConflicto).toEqual([{ id: 5, nombre: 'Paraná' }]);
  });

  it('una consulta social sin salón ni líneas nace sin armar y sin vencimiento', async () => {
    buscarEventoMock.mockResolvedValue(
      eventoOriginal({
        tipo: 'Social',
        tipoSocial: 'Cumpleanos',
        salones: [],
        presupuestos: [{ id: 31, estado: 'Estimado', lineas: [] }],
      }),
    );

    const respuesta = await reutilizar();

    expect(respuesta.status).toBe(201);
    expect(datosDelEvento()).toMatchObject({ tipo: 'Social', tipoSocial: 'Cumpleanos' });
    expect(datosDelPresupuesto()).toMatchObject({ venceEn: null, total: '0.00', lineas: [] });
    expect(buscarReservadosMock).not.toHaveBeenCalled();
  });

  it('responde 400 si la fecha es hoy o ya pasó, sin crear nada', async () => {
    const hoy = await reutilizar({ fecha: '2026-10-16' });
    const pasada = await reutilizar({ fecha: '2026-09-01' });

    expect(hoy.status).toBe(400);
    expect(hoy.body.error.details).toEqual([
      { campo: 'fecha', mensaje: 'La fecha del evento nuevo tiene que ser futura' },
    ]);
    expect(pasada.status).toBe(400);
    expect(crearEventoMock).not.toHaveBeenCalled();
  });

  it('responde 400 sin fecha', async () => {
    const respuesta = await reutilizar({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 404 si el evento no existe', async () => {
    buscarEventoMock.mockResolvedValue(null);

    const respuesta = await reutilizar({ fecha: '2026-12-04' }, 404);

    expect(respuesta.status).toBe(404);
  });

  it('el rol Cliente no puede reutilizar un evento', async () => {
    const respuesta = await request(app)
      .post('/api/eventos/20/reutilizar')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ fecha: '2026-12-04' });

    expect(respuesta.status).toBe(403);
    expect(crearEventoMock).not.toHaveBeenCalled();
  });
});
