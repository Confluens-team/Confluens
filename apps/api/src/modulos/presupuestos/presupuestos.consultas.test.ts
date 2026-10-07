import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// HU-12: detalle, modificación (también recalcular) y dar de baja una consulta. Mismo criterio que
// presupuestos.rutas.test.ts: el repositorio se mockea entero y la transacción ejecuta el callback.
vi.mock('./presupuestos.repositorio.js', () => ({
  buscarSalon: vi.fn(),
  buscarServiciosPorIds: vi.fn(),
  crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
  buscarPresupuestoDetallado: vi.fn(),
  actualizarEvento: vi.fn(),
  actualizarPresupuesto: vi.fn(),
  reemplazarLineas: vi.fn(),
}));

const repo = await import('./presupuestos.repositorio.js');
const buscarSalonMock = vi.mocked(repo.buscarSalon);
const buscarServiciosPorIdsMock = vi.mocked(repo.buscarServiciosPorIds);
const buscarPresupuestoDetalladoMock = vi.mocked(repo.buscarPresupuestoDetallado);
const actualizarEventoMock = vi.mocked(repo.actualizarEvento);
const actualizarPresupuestoMock = vi.mocked(repo.actualizarPresupuesto);
const reemplazarLineasMock = vi.mocked(repo.reemplazarLineas);

const app = crearApp();
const D = (valor: string) => new Prisma.Decimal(valor);
const DIEZ_DIAS = 10 * 24 * 60 * 60 * 1000;

function cookieDe(
  rol: 'RESPONSABLE_EVENTOS' | 'ADMINISTRADOR_SISTEMA' | 'RESPONSABLE_FINANZAS' | 'CLIENTE',
) {
  return `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email: 'personal@confluens.test', rol })}`;
}
const cookieRE = cookieDe('RESPONSABLE_EVENTOS');

const salonParana = {
  id: 5,
  nombre: 'Paraná',
  capacidadMaxima: 12,
  superficie: 24,
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
    activo: true,
    categoria: null,
    fotoUrl: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ...datos,
    precio: datos.precio === null ? null : D(datos.precio),
  };
}

// Consulta Estimado con el salón a precio congelado (142200, hoy vale 150000) y un coffee a 8000
// (hoy vale 8730).
function consulta(datos: Record<string, unknown> = {}, evento: Record<string, unknown> = {}) {
  return {
    id: 31,
    eventoId: 20,
    estado: 'Estimado',
    fechaEmision: new Date('2026-09-20T15:00:00.000Z'),
    venceEn: new Date('2026-09-30T15:00:00.000Z'),
    total: D('222200'),
    requiereFactura: false,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    evento: {
      id: 20,
      clienteId: 10,
      salonId: 5,
      distribucionId: null,
      fecha: new Date('2026-11-15T00:00:00.000Z'),
      inicio: null,
      fin: null,
      cantidadPersonas: 10,
      estado: 'EnConsulta',
      senaVenceEn: null,
      senaRegistradaEn: null,
      tipo: 'Corporativo' as 'Social' | 'Corporativo',
      tipoSocial: null,
      tipoSocialDetalle: null as string | null,
      tipoJornada: null,
      horaInicioEstimada: null as string | null,
      modalidadSalonRestaurante: false,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
      cliente: {
        id: 10,
        nombre: 'Marina',
        apellido: 'Gómez',
        telefono: '+5493515551234',
        correo: 'marina@example.com',
      },
      salon: salonParana,
      distribucion: null,
      ...evento,
    },
    lineas: [
      {
        id: 1,
        presupuestoId: 31,
        servicioId: null,
        descripcion: 'Salón Paraná (jornada completa)',
        cantidad: 1,
        precioUnitario: D('142200'),
        subtotal: D('142200'),
        aCotizar: false,
        servicio: null,
      },
      {
        id: 2,
        presupuestoId: 31,
        servicioId: 1,
        descripcion: 'Coffee Refresh',
        cantidad: 10,
        precioUnitario: D('8000'),
        subtotal: D('80000'),
        aCotizar: false,
        servicio: { tercerizado: false },
      },
    ],
    ...datos,
  } as never;
}

const coffee = servicio({ id: 1, nombre: 'Coffee Refresh', precio: '8730' });
const pantallas = servicio({ id: 2, nombre: 'Pantallas LED', precio: '50000', tercerizado: true });

const bodyBase = {
  fecha: '2026-11-20',
  salonId: 5,
  cantidadPersonas: 12,
  tipoJornada: 'completa',
  servicios: [{ servicioId: 1, cantidad: 12 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  buscarPresupuestoDetalladoMock.mockResolvedValue(consulta());
  buscarSalonMock.mockResolvedValue(salonParana);
  buscarServiciosPorIdsMock.mockResolvedValue([coffee, pantallas]);
});

describe('GET /api/presupuestos/:id (HU-12)', () => {
  it('devuelve la consulta con su jornada, cliente, salón y líneas', async () => {
    const respuesta = await request(app).get('/api/presupuestos/31').set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      id: 31,
      estado: 'Estimado',
      total: '222200.00',
      tipoJornada: 'completa',
      evento: { id: 20, estado: 'EnConsulta', fecha: '2026-11-15', cantidadPersonas: 10 },
      cliente: { nombre: 'Marina', apellido: 'Gómez', telefono: '+5493515551234' },
      salon: { id: 5, nombre: 'Paraná', capacidadMaxima: 12 },
    });
    expect(respuesta.body.data.lineas[1]).toEqual({
      id: 2,
      presupuestoId: 31,
      servicioId: 1,
      descripcion: 'Coffee Refresh',
      cantidad: 10,
      precioUnitario: '8000.00',
      subtotal: '80000.00',
      aCotizar: false,
      tipo: 'servicio',
      tercerizado: false,
    });
  });

  it('distingue el salón (la primera línea sin servicio) de los adicionales escritos a mano', async () => {
    const base = consulta() as unknown as { lineas: object[] };
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({
        lineas: [
          ...base.lineas,
          {
            id: 3,
            presupuestoId: 31,
            servicioId: null,
            descripcion: 'Decoración con globos',
            cantidad: 1,
            precioUnitario: D('25000'),
            subtotal: D('25000'),
            aCotizar: false,
            servicio: null,
          },
        ],
      }),
    );

    const respuesta = await request(app).get('/api/presupuestos/31').set('Cookie', [cookieRE]);

    expect(respuesta.body.data.lineas.map((l: { tipo: string }) => l.tipo)).toEqual([
      'salon',
      'servicio',
      'adicional',
    ]);
    expect(respuesta.body.data.tipoJornada).toBe('completa');
  });

  it('muestra la distribución y el horario del evento agendado (HU-11)', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta(
        {},
        {
          distribucionId: 2,
          distribucion: { id: 2, nombre: 'Banquete' },
          inicio: new Date('2026-11-15T23:00:00.000Z'),
          fin: new Date('2026-11-16T05:00:00.000Z'),
        },
      ),
    );

    const respuesta = await request(app).get('/api/presupuestos/31').set('Cookie', [cookieRE]);

    expect(respuesta.body.data.evento).toMatchObject({
      distribucion: { id: 2, nombre: 'Banquete' },
      inicio: '2026-11-15T23:00:00.000Z',
      fin: '2026-11-16T05:00:00.000Z',
    });
  });

  it('responde 404 si el presupuesto no existe', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(null);

    const respuesta = await request(app).get('/api/presupuestos/999').set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(404);
  });

  // Provisorio (06/10/2026): todo el personal entra; el Cliente no.
  it('responde 401 sin sesión, 403 al Cliente y deja entrar a cualquier rol del personal', async () => {
    expect((await request(app).get('/api/presupuestos/31')).status).toBe(401);
    const cliente = await request(app)
      .get('/api/presupuestos/31')
      .set('Cookie', [cookieDe('CLIENTE')]);
    expect(cliente.status).toBe(403);
    const finanzas = await request(app)
      .get('/api/presupuestos/31')
      .set('Cookie', [cookieDe('RESPONSABLE_FINANZAS')]);
    expect(finanzas.status).toBe(200);
  });
});

describe('PATCH /api/presupuestos/:id (HU-12)', () => {
  const lineasGuardadas = () => reemplazarLineasMock.mock.calls[0]![1];
  const datosDelPresupuesto = () => actualizarPresupuestoMock.mock.calls[0]![1];

  it('conserva los precios congelados de lo que ya estaba y reinicia la vigencia', async () => {
    const antes = Date.now();
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(200);
    expect(lineasGuardadas()).toEqual([
      {
        servicioId: null,
        descripcion: 'Salón Paraná (jornada completa)',
        cantidad: 1,
        precioUnitario: '142200.00',
        subtotal: '142200.00',
        aCotizar: false,
      },
      {
        servicioId: 1,
        descripcion: 'Coffee Refresh',
        cantidad: 12,
        precioUnitario: '8000.00',
        subtotal: '96000.00',
        aCotizar: false,
      },
    ]);
    const { estado, total, venceEn } = datosDelPresupuesto() as {
      estado: string;
      total: string;
      venceEn: Date;
    };
    expect(estado).toBe('Estimado');
    expect(total).toBe('238200.00');
    expect(venceEn.getTime()).toBeGreaterThanOrEqual(antes + DIEZ_DIAS);
    expect(actualizarEventoMock).toHaveBeenCalledWith(
      20,
      {
        fecha: new Date('2026-11-20'),
        salon: { connect: { id: 5 } },
        cantidadPersonas: 12,
        tipo: 'Corporativo',
        tipoSocial: null,
        tipoSocialDetalle: null,
        tipoJornada: 'completa',
        horaInicioEstimada: undefined,
      },
      undefined,
    );
  });

  it('un servicio nuevo toma el precio vigente y un tercerizado suma al total', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [...bodyBase.servicios, { servicioId: 2, cantidad: 1 }] });

    expect(lineasGuardadas()[2]).toMatchObject({ servicioId: 2, precioUnitario: '50000.00' });
    // 142200 + 12 × 8000 + 50000
    expect((datosDelPresupuesto() as { total: string }).total).toBe('288200.00');
  });

  it('un tercerizado a cotizar entra sin importe y no suma al total (HU-11)', async () => {
    const leds = servicio({ id: 3, nombre: 'Pantallas LED', precio: null, tercerizado: true });
    buscarServiciosPorIdsMock.mockResolvedValue([coffee, leds]);

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [...bodyBase.servicios, { servicioId: 3, cantidad: 1 }] });

    expect(lineasGuardadas()[2]).toEqual({
      servicioId: 3,
      descripcion: 'Pantallas LED',
      cantidad: 1,
      precioUnitario: '0.00',
      subtotal: '0.00',
      aCotizar: true,
    });
    expect((datosDelPresupuesto() as { total: string }).total).toBe('238200.00');
  });

  it('una línea a cotizar sigue así hasta que llega su precio, y con él suma (HU-11)', async () => {
    const leds = servicio({ id: 3, nombre: 'Pantallas LED', precio: null, tercerizado: true });
    buscarServiciosPorIdsMock.mockResolvedValue([coffee, leds]);
    const base = consulta() as unknown as { lineas: object[] };
    const conLeds = {
      lineas: [
        ...base.lineas,
        {
          id: 3,
          presupuestoId: 31,
          servicioId: 3,
          descripcion: 'Pantallas LED',
          cantidad: 1,
          precioUnitario: D('0'),
          subtotal: D('0'),
          aCotizar: true,
          servicio: { tercerizado: true },
        },
      ],
    };
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta(conLeds));

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [...bodyBase.servicios, { servicioId: 3, cantidad: 1 }] });
    expect(lineasGuardadas()[2]).toMatchObject({ aCotizar: true, subtotal: '0.00' });

    reemplazarLineasMock.mockClear();
    actualizarPresupuestoMock.mockClear();
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        servicios: [...bodyBase.servicios, { servicioId: 3, cantidad: 1, precioUnitario: '90000' }],
      });
    expect(lineasGuardadas()[2]).toMatchObject({ aCotizar: false, subtotal: '90000.00' });
    expect((datosDelPresupuesto() as { total: string }).total).toBe('328200.00');
  });

  it('un precio unitario explícito es un ajuste comercial y manda (RN-03)', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        precioSalon: '130000',
        servicios: [{ servicioId: 1, cantidad: 12, precioUnitario: '7500.50' }],
      });

    expect(lineasGuardadas()[0]).toMatchObject({ precioUnitario: '130000.00' });
    expect(lineasGuardadas()[1]).toMatchObject({
      precioUnitario: '7500.50',
      subtotal: '90006.00',
    });
  });

  it('al cambiar la jornada o el salón la línea del salón toma el precio vigente', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, tipoJornada: 'media' });

    expect(lineasGuardadas()[0]).toMatchObject({
      descripcion: 'Salón Paraná (media jornada)',
      precioUnitario: '110000.00',
    });
  });

  it('guarda los adicionales escritos a mano con su precio, después de los servicios', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        adicionales: [
          { descripcion: '  Decoración con globos ', cantidad: 2, precioUnitario: '12500' },
        ],
      });

    expect(lineasGuardadas()[2]).toEqual({
      servicioId: null,
      descripcion: 'Decoración con globos',
      cantidad: 2,
      precioUnitario: '12500.00',
      subtotal: '25000.00',
      aCotizar: false,
    });
    // 142200 + 12 × 8000 + 2 × 12500
    expect((datosDelPresupuesto() as { total: string }).total).toBe('263200.00');
  });

  it('responde 400 VALIDATION_ERROR si un adicional no tiene descripción o precio', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, adicionales: [{ descripcion: ' ', cantidad: 1 }] });

    expect(respuesta.status).toBe(400);
  });

  it('recalcular un Expirado con los precios vigentes lo vuelve Estimado sin crear otro', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({ estado: 'Expirado' }));

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        cantidadPersonas: 10,
        precioSalon: '150000',
        servicios: [{ servicioId: 1, cantidad: 10, precioUnitario: '8730' }],
      });

    expect(respuesta.status).toBe(200);
    expect(datosDelPresupuesto()).toMatchObject({ estado: 'Estimado', total: '237300.00' });
    expect(reemplazarLineasMock.mock.calls[0]![0]).toBe(31);
  });

  it('marca si el cliente requiere factura, que define la base de cobro (RN-01)', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, requiereFactura: true });

    expect(datosDelPresupuesto()).toMatchObject({ requiereFactura: true });
  });

  it('un Expirado modificado vuelve a Estimado', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({ estado: 'Expirado' }));

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(200);
    expect(datosDelPresupuesto()).toMatchObject({ estado: 'Estimado' });
  });

  it.each(['Confirmado', 'Cancelado'])('responde 409 si el presupuesto está %s', async (estado) => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({ estado }));

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(409);
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  it('responde 409 si el evento ya no está en consulta', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({}, { estado: 'Reservado' }));

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(409);
  });

  it('responde 422 si se agrega un servicio que no está activo', async () => {
    buscarServiciosPorIdsMock.mockResolvedValue([coffee, { ...pantallas, activo: false }]);

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [...bodyBase.servicios, { servicioId: 2, cantidad: 1 }] });

    expect(respuesta.status).toBe(422);
  });

  it('acepta un servicio que ya estaba aunque hoy no esté activo', async () => {
    buscarServiciosPorIdsMock.mockResolvedValue([{ ...coffee, activo: false }]);

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(200);
  });

  it('responde 404 si el salón o un servicio no existen', async () => {
    buscarSalonMock.mockResolvedValue(null);
    const sinSalon = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);
    expect(sinSalon.status).toBe(404);

    buscarSalonMock.mockResolvedValue(salonParana);
    const sinServicio = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [{ servicioId: 99, cantidad: 1 }] });
    expect(sinServicio.status).toBe(404);
  });

  it('responde 400 VALIDATION_ERROR si un servicio aparece dos veces', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [...bodyBase.servicios, { servicioId: 1, cantidad: 2 }] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Consultas sociales (ADR 0008)', () => {
  const lineasGuardadas = () => reemplazarLineasMock.mock.calls[0]![1];
  const datosDelPresupuesto = () =>
    actualizarPresupuestoMock.mock.calls[0]![1] as { venceEn: Date | null; total: string };
  const datosDelEvento = () => actualizarEventoMock.mock.calls[0]![1] as Record<string, unknown>;

  // Consulta social recién llegada: sin salón, sin líneas y sin vencimiento.
  const consultaSocial = (evento: Record<string, unknown> = {}) =>
    consulta(
      { venceEn: null, total: D('0'), lineas: [] },
      {
        salonId: null,
        salon: null,
        tipo: 'Social',
        tipoSocial: 'Casamiento',
        tipoJornada: 'media',
        horaInicioEstimada: '21:00',
        ...evento,
      },
    );
  const bodySocial = {
    fecha: '2026-11-20',
    salonId: null,
    cantidadPersonas: 120,
    tipoJornada: 'media',
    servicios: [],
  };

  beforeEach(() => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consultaSocial());
  });

  it('el detalle viene sin salón ni vencimiento, con el tipo, la jornada y la hora que eligió el cliente', async () => {
    const respuesta = await request(app).get('/api/presupuestos/31').set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      venceEn: null,
      salon: null,
      tipoJornada: 'media',
      lineas: [],
      evento: {
        tipo: 'Social',
        tipoSocial: 'Casamiento',
        tipoSocialDetalle: null,
        horaInicioEstimada: '21:00',
      },
    });
  });

  it('guardarla sin salón ni servicios la deja sin armar: no arranca la vigencia', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodySocial);

    expect(respuesta.status).toBe(200);
    expect(lineasGuardadas()).toEqual([]);
    expect(datosDelPresupuesto()).toMatchObject({ venceEn: null, total: '0.00' });
    expect(datosDelEvento()).toMatchObject({
      salon: { disconnect: true },
      tipo: 'Social',
      tipoSocial: 'Casamiento',
    });
    expect(buscarSalonMock).not.toHaveBeenCalled();
  });

  it('al cargarle el salón queda armada: línea del salón y 10 días de vigencia desde ahora', async () => {
    const antes = Date.now();

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodySocial, salonId: 5, cantidadPersonas: 12 });

    expect(lineasGuardadas()).toEqual([
      expect.objectContaining({
        descripcion: 'Salón Paraná (media jornada)',
        subtotal: '110000.00',
      }),
    ]);
    const { venceEn, total } = datosDelPresupuesto();
    expect(total).toBe('110000.00');
    expect(venceEn!.getTime()).toBeGreaterThanOrEqual(antes + DIEZ_DIAS);
  });

  it('con solo un adicional, sin salón, también arranca la vigencia', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodySocial,
        adicionales: [{ descripcion: 'Ambientación', cantidad: 1, precioUnitario: '50000' }],
      });

    expect(datosDelPresupuesto().venceEn).toBeInstanceOf(Date);
    expect(datosDelPresupuesto().total).toBe('50000.00');
  });

  it('el personal puede cambiar el tipo social, su detalle y la hora estimada', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodySocial,
        tipo: 'Social',
        tipoSocial: 'Otro',
        tipoSocialDetalle: 'Aniversario',
        horaInicioEstimada: null,
      });

    expect(datosDelEvento()).toMatchObject({
      tipoSocial: 'Otro',
      tipoSocialDetalle: 'Aniversario',
      horaInicioEstimada: null,
    });
  });

  it('pasarla a corporativo exige salón y limpia el tipo social', async () => {
    const sinSalon = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodySocial, tipo: 'Corporativo' });
    expect(sinSalon.status).toBe(400);

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodySocial, tipo: 'Corporativo', salonId: 5, cantidadPersonas: 12 });
    expect(datosDelEvento()).toMatchObject({
      tipo: 'Corporativo',
      tipoSocial: null,
      tipoSocialDetalle: null,
    });
  });

  it('una consulta corporativa no puede quedar sin salón (422)', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta());

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodySocial);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toBe('Un evento corporativo necesita salón');
    expect(actualizarEventoMock).not.toHaveBeenCalled();
  });

  it('pasarla a social sin decir qué tipo es responde 400', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta());

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodySocial, tipo: 'Social' });

    expect(respuesta.status).toBe(400);
  });
});

describe('POST /api/presupuestos/:id/dar-de-baja (HU-12)', () => {
  it('pasa la consulta a Cancelado y cancela su evento (un presupuesto por evento)', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos/31/dar-de-baja')
      .set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(200);
    expect(actualizarPresupuestoMock).toHaveBeenCalledWith(31, { estado: 'Cancelado' }, undefined);
    expect(actualizarEventoMock).toHaveBeenCalledWith(20, { estado: 'Cancelado' }, undefined);
  });

  it('responde 409 si el presupuesto está Confirmado', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({ estado: 'Confirmado' }));

    const respuesta = await request(app)
      .post('/api/presupuestos/31/dar-de-baja')
      .set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(409);
  });
});
