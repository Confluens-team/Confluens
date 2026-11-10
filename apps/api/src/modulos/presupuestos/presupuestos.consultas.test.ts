import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

// HU-12: detalle, modificación (también recalcular) y dar de baja una consulta. Mismo criterio que
// presupuestos.rutas.test.ts: el repositorio se mockea entero y la transacción ejecuta el callback.
vi.mock('./presupuestos.repositorio.js', () => ({
  buscarSalon: vi.fn(),
  buscarSalonesPorIds: vi.fn(),
  quitarSalonesDelEvento: vi.fn(),
  reemplazarSalonesDelEvento: vi.fn(),
  buscarServiciosPorIds: vi.fn(),
  crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
  obtenerPorcentajeMensual: vi.fn(() => Promise.resolve('0')),
  buscarEventoParaReutilizar: vi.fn(),
  buscarSalonesReservadosEseDia: vi.fn(() => Promise.resolve([])),
  buscarPresupuestoDetallado: vi.fn(),
  actualizarEvento: vi.fn(),
  actualizarPresupuesto: vi.fn(),
  reemplazarLineas: vi.fn(),
  sumarPagos: vi.fn(),
  buscarDistribucionPorNombre: vi.fn(),
}));

const repo = await import('./presupuestos.repositorio.js');
const buscarSalonMock = vi.mocked(repo.buscarSalon);
const buscarSalonesPorIdsMock = vi.mocked(repo.buscarSalonesPorIds);
const reemplazarSalonesDelEventoMock = vi.mocked(repo.reemplazarSalonesDelEvento);
const buscarServiciosPorIdsMock = vi.mocked(repo.buscarServiciosPorIds);
const buscarPresupuestoDetalladoMock = vi.mocked(repo.buscarPresupuestoDetallado);
const actualizarEventoMock = vi.mocked(repo.actualizarEvento);
const actualizarPresupuestoMock = vi.mocked(repo.actualizarPresupuesto);
const reemplazarLineasMock = vi.mocked(repo.reemplazarLineas);
const sumarPagosMock = vi.mocked(repo.sumarPagos);
const buscarDistribucionPorNombreMock = vi.mocked(repo.buscarDistribucionPorNombre);

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
    ocultoEn: null as Date | null,
    avisoRecepcionEn: null as Date | null,
    envioFormalEn: null as Date | null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    evento: {
      id: 20,
      clienteId: 10,
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
      horaFinEstimada: null as string | null,
      modalidadSalonRestaurante: false,
      observacionesComanda: null as string | null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
      cliente: {
        id: 10,
        nombre: 'Marina',
        apellido: 'Gómez',
        telefono: '+5493515551234',
        correo: 'marina@example.com',
      },
      salones: [
        {
          eventoId: 20,
          salonId: salonParana.id,
          distribucionId: null as number | null,
          inicio: null as Date | null,
          fin: null as Date | null,
          estado: 'EnConsulta' as const,
          creadoEn: new Date(),
          salon: salonParana,
          distribucion: null as {
            id: number;
            salonId: number;
            nombre: string;
            capacidad: number;
          } | null,
        },
      ],
      ...evento,
    },
    lineas: [
      {
        id: 1,
        presupuestoId: 31,
        servicioId: null,
        salonId: salonParana.id,
        descripcion: 'Salón Paraná (jornada completa)',
        cantidad: 1,
        precioUnitario: D('142200'),
        subtotal: D('142200'),
        aCotizar: false,
        modalidad: 'Normal' as const,
        precioBase: null,
        horaEstimada: null,
        servicio: null,
      },
      {
        id: 2,
        presupuestoId: 31,
        servicioId: 1,
        salonId: null,
        descripcion: 'Coffee Refresh',
        cantidad: 10,
        precioUnitario: D('8000'),
        subtotal: D('80000'),
        aCotizar: false,
        modalidad: 'Normal' as const,
        precioBase: null,
        horaEstimada: '10:30',
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
  salones: [{ salonId: 5 }],
  cantidadPersonas: 12,
  tipoJornada: 'completa',
  servicios: [{ servicioId: 1, cantidad: 12 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  buscarPresupuestoDetalladoMock.mockResolvedValue(consulta());
  buscarSalonMock.mockResolvedValue(salonParana);
  buscarSalonesPorIdsMock.mockResolvedValue([salonParana]);
  buscarSalonesPorIdsMock.mockResolvedValue([salonParana]);
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
      salones: [{ id: 5, nombre: 'Paraná', capacidadMaxima: 12 }],
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
      modalidad: 'Normal' as const,
      precioBase: null,
      horaEstimada: '10:30',
      salonId: null,
      tipo: 'servicio',
      tercerizado: false,
      admiteModalidad: false,
    });
  });

  // Antes el tipo salía de la posición: "la primera línea sin servicio" era el salón. Con varios
  // salones por evento eso no alcanza, y un adicional cargado antes que el salón se hacía pasar
  // por salón.
  it('reconoce el salón aunque no sea la primera línea', async () => {
    const base = consulta() as unknown as { lineas: { id: number }[] };
    const salon = base.lineas[0]!;
    const servicio = base.lineas[1]!;
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({
        lineas: [
          {
            id: 0, // id menor que el del salón: antes esta línea ganaba
            presupuestoId: 31,
            servicioId: null,
            salonId: null,
            descripcion: 'Decoración con globos',
            cantidad: 1,
            precioUnitario: D('25000'),
            subtotal: D('25000'),
            aCotizar: false,
            modalidad: 'Normal' as const,
            precioBase: null,
            horaEstimada: null,
            servicio: null,
          },
          salon,
          servicio,
        ],
      }),
    );

    const respuesta = await request(app).get('/api/presupuestos/31').set('Cookie', [cookieRE]);

    expect(respuesta.body.data.lineas.map((l: { tipo: string }) => l.tipo)).toEqual([
      'adicional',
      'salon',
      'servicio',
    ]);
  });

  it('distingue el salón (el que tiene salonId) de los adicionales escritos a mano', async () => {
    const base = consulta() as unknown as { lineas: object[] };
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({
        lineas: [
          ...base.lineas,
          {
            id: 3,
            presupuestoId: 31,
            servicioId: null,
            salonId: null,
            descripcion: 'Decoración con globos',
            cantidad: 1,
            precioUnitario: D('25000'),
            subtotal: D('25000'),
            aCotizar: false,
            modalidad: 'Normal' as const,
            precioBase: null,
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
          salones: [
            {
              eventoId: 20,
              salonId: salonParana.id,
              distribucionId: 2,
              inicio: null,
              fin: null,
              estado: 'EnConsulta' as const,
              creadoEn: new Date(),
              salon: salonParana,
              distribucion: { id: 2, salonId: salonParana.id, nombre: 'Banquete', capacidad: 12 },
            },
          ],
          inicio: new Date('2026-11-15T23:00:00.000Z'),
          fin: new Date('2026-11-16T05:00:00.000Z'),
        },
      ),
    );

    const respuesta = await request(app).get('/api/presupuestos/31').set('Cookie', [cookieRE]);

    expect(respuesta.body.data.evento).toMatchObject({
      inicio: '2026-11-15T23:00:00.000Z',
      fin: '2026-11-16T05:00:00.000Z',
    });
    // ADR 0011: la distribución es de cada salón, no del evento.
    expect(respuesta.body.data.salones[0].distribucion).toEqual({ id: 2, nombre: 'Banquete' });
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

  // RN-04: un servicio que se cobra por persona se puede contratar para menos gente que la que
  // asiste, nunca para más. Vale igual que al crear: el personal baja los asistentes y la cantidad
  // del coffee tiene que acompañar.
  it('rechaza con 422 un servicio por persona contratado para más gente que la que asiste', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, cantidadPersonas: 12, servicios: [{ servicioId: 1, cantidad: 13 }] });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(respuesta.body.error.message).toContain('Coffee Refresh');
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  // Un adicional escrito a mano se mide en unidades, no en personas: 20 centros de mesa para 12
  // invitados es un pedido razonable y no lo frena esta regla.
  it('no le aplica el tope de asistentes a un adicional escrito a mano', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        cantidadPersonas: 12,
        servicios: [],
        adicionales: [{ descripcion: 'Centros de mesa', cantidad: 20, precioUnitario: '1500' }],
      });

    expect(respuesta.status).toBe(200);
  });

  it('conserva los precios congelados de lo que ya estaba y reinicia la emisión y la vigencia', async () => {
    const antes = Date.now();
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(200);
    expect(lineasGuardadas()).toEqual([
      {
        servicioId: null,
        salonId: salonParana.id,
        descripcion: 'Salón Paraná (jornada completa)',
        cantidad: 1,
        precioUnitario: '142200.00',
        subtotal: '142200.00',
        aCotizar: false,
        modalidad: 'Normal' as const,
        precioBase: null,
        horaEstimada: null,
      },
      {
        servicioId: 1,
        salonId: null,
        descripcion: 'Coffee Refresh',
        cantidad: 12,
        precioUnitario: '8000.00',
        subtotal: '96000.00',
        aCotizar: false,
        modalidad: 'Normal' as const,
        precioBase: '8000.00',
        horaEstimada: null,
      },
    ]);
    const { estado, total, fechaEmision, venceEn } = datosDelPresupuesto() as {
      estado: string;
      total: string;
      fechaEmision: Date;
      venceEn: Date;
    };
    expect(estado).toBe('Estimado');
    expect(total).toBe('238200.00');
    // HU-27: se emite de nuevo con la fecha del recálculo, y los 10 días cuentan desde ahí.
    expect(fechaEmision.getTime()).toBeGreaterThanOrEqual(antes);
    expect(venceEn.getTime()).toBe(fechaEmision.getTime() + DIEZ_DIAS);
    expect(actualizarEventoMock).toHaveBeenCalledWith(
      20,
      {
        fecha: new Date('2026-11-20'),
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
      salonId: null,
      descripcion: 'Pantallas LED',
      cantidad: 1,
      precioUnitario: '0.00',
      subtotal: '0.00',
      aCotizar: true,
      modalidad: 'Normal' as const,
      precioBase: null,
      horaEstimada: null,
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
          modalidad: 'Normal' as const,
          precioBase: null,
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
        salones: [{ salonId: 5, precioUnitario: '130000' }],
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
      salonId: null,
      descripcion: 'Decoración con globos',
      cantidad: 2,
      precioUnitario: '12500.00',
      subtotal: '25000.00',
      aCotizar: false,
      modalidad: 'Normal' as const,
      precioBase: null,
      horaEstimada: null,
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
        salones: [{ salonId: 5, precioUnitario: '150000' }],
        servicios: [{ servicioId: 1, cantidad: 10, precioUnitario: '8730' }],
      });

    expect(respuesta.status).toBe(200);
    expect(datosDelPresupuesto()).toMatchObject({ estado: 'Estimado', total: '237300.00' });
    expect(reemplazarLineasMock.mock.calls[0]![0]).toBe(31);
  });

  // HU-53: la marca de factura ya no se elige. Un presupuesto anterior conserva la suya aunque el
  // pedido traiga otra (un cliente viejo de la web).
  it('no cambia la marca de factura del presupuesto (HU-53)', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, requiereFactura: true });

    expect(datosDelPresupuesto()).not.toHaveProperty('requiereFactura');
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
    buscarSalonesPorIdsMock.mockResolvedValue([]);
    const sinSalon = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);
    expect(sinSalon.status).toBe(404);

    buscarSalonesPorIdsMock.mockResolvedValue([salonParana]);
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

// RN-09: el Responsable de Eventos modifica en todo momento, también un evento ya confirmado
// (decisión de Franco, 08/10/2026). El presupuesto sigue Confirmado y el estado del evento sale de
// lo pagado contra el total nuevo.
describe('PATCH /api/presupuestos/:id sobre un evento confirmado (RN-09)', () => {
  const banquete = { id: 15, salonId: 5, nombre: 'Banquete', capacidad: 12 };
  // Reservado el 15/11 de 21:00 a 05:00 (hora argentina), con la seña de 50.000 pagada.
  const confirmada = (evento: Record<string, unknown> = {}) =>
    consulta(
      { estado: 'Confirmado' },
      {
        estado: 'Reservado',
        salones: [
          {
            eventoId: 20,
            salonId: 5,
            distribucionId: 15,
            inicio: null,
            fin: null,
            estado: 'Reservado' as const,
            creadoEn: new Date(),
            salon: salonParana,
            distribucion: banquete,
          },
        ],
        inicio: new Date('2026-11-16T00:00:00.000Z'),
        fin: new Date('2026-11-16T08:00:00.000Z'),
        ...evento,
      },
    );
  const datosDelEvento = () => actualizarEventoMock.mock.calls[0]![1] as Record<string, unknown>;
  const datosDelPresupuesto = () =>
    actualizarPresupuestoMock.mock.calls[0]![1] as Record<string, unknown>;

  beforeEach(() => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(confirmada());
    sumarPagosMock.mockResolvedValue(D('50000'));
  });

  it('se guarda sin volver a Estimado, reinicia la emisión y la vigencia y el evento sigue Reservado', async () => {
    const antes = Date.now();
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(200);
    // Sin estado: sigue Confirmado. requiereFactura no viene, así que no se toca.
    const { fechaEmision, venceEn, ...resto } = datosDelPresupuesto() as {
      fechaEmision: Date;
      venceEn: Date;
    };
    expect(resto).toEqual({ total: '238200.00' });
    // RN-08 (HU-27): cada recálculo vuelve a emitir el presupuesto con la fecha de hoy y reinicia
    // los 10 días, también en un Confirmado.
    expect(fechaEmision.getTime()).toBeGreaterThanOrEqual(antes);
    expect(venceEn.getTime()).toBe(fechaEmision.getTime() + DIEZ_DIAS);
    expect(datosDelEvento().estado).toBe('Reservado');
  });

  it('si cambia la fecha, el horario se corre los mismos días y conserva las horas', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, fecha: '2026-11-20' });

    expect(datosDelEvento()).toMatchObject({
      fecha: new Date('2026-11-20'),
      inicio: new Date('2026-11-21T00:00:00.000Z'),
      fin: new Date('2026-11-21T08:00:00.000Z'),
    });
  });

  it('si lo pagado cubre el total nuevo, el evento pasa a Cobrado aunque el saldo quede negativo', async () => {
    sumarPagosMock.mockResolvedValue(D('300000'));

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(200);
    expect(datosDelEvento().estado).toBe('Cobrado');
  });

  it('un Cobrado al que se le suman servicios vuelve a Reservado para poder cobrar la diferencia', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(confirmada({ estado: 'Cobrado' }));
    sumarPagosMock.mockResolvedValue(D('222200'));

    await request(app).patch('/api/presupuestos/31').set('Cookie', [cookieRE]).send(bodyBase);

    expect(datosDelEvento().estado).toBe('Reservado');
  });

  // ADR 0011: con varios salones, el que entra hereda el armado y los que ya estaban no se tocan
  // (no se los busca ni se los manda: el repositorio conserva su renglón con su distribución).
  it('al sumar un salón a un evento armado, solo el nuevo hereda el armado', async () => {
    const pucara = { ...salonParana, id: 2, nombre: 'Pucará' };
    buscarSalonesPorIdsMock.mockResolvedValue([salonParana, pucara]);
    buscarDistribucionPorNombreMock.mockResolvedValue({ ...banquete, id: 6, salonId: 2 } as never);

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, salones: [{ salonId: 5 }, { salonId: 2 }] });

    expect(buscarDistribucionPorNombreMock).toHaveBeenCalledTimes(1);
    expect(buscarDistribucionPorNombreMock).toHaveBeenCalledWith(2, 'Banquete');
    expect(reemplazarSalonesDelEventoMock).toHaveBeenCalledWith(
      20,
      [5, 2],
      undefined,
      new Map([[2, 6]]),
    );
  });

  it('si el salón nuevo no tiene un armado con ese nombre, entra sin distribución', async () => {
    buscarSalonesPorIdsMock.mockResolvedValue([{ ...salonParana, id: 2, nombre: 'Pucará' }]);
    buscarDistribucionPorNombreMock.mockResolvedValue(null);

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, salones: [{ salonId: 2 }] });

    expect(reemplazarSalonesDelEventoMock).toHaveBeenCalledWith(20, [2], undefined, new Map());
  });

  it('al cambiar de salón conserva la distribución del mismo nombre en el salón nuevo', async () => {
    buscarSalonesPorIdsMock.mockResolvedValue([{ ...salonParana, id: 2, nombre: 'Pucará' }]);
    buscarDistribucionPorNombreMock.mockResolvedValue({ ...banquete, id: 6, salonId: 2 } as never);

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, salones: [{ salonId: 2 }] });

    expect(buscarDistribucionPorNombreMock).toHaveBeenCalledWith(2, 'Banquete');
    expect(reemplazarSalonesDelEventoMock).toHaveBeenCalledWith(
      20,
      [2],
      undefined,
      new Map([[2, 6]]),
    );
  });

  it('responde 422 si se le saca el salón', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, salones: [], tipo: 'Social', tipoSocial: 'Cumpleanos' });

    expect(respuesta.status).toBe(422);
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  // El salón que se deja no tiene que viajar a la fecha nueva: el trigger copia el horario del
  // evento a todos sus salones, y si todavía está, choca con quien lo tenga reservado ese día.
  it('al cambiar de salón y de fecha, saca el salón que se deja antes de mover el evento', async () => {
    const quitarMock = vi.mocked(repo.quitarSalonesDelEvento);
    buscarSalonesPorIdsMock.mockResolvedValue([{ ...salonParana, id: 2, nombre: 'Pucará' }]);
    buscarDistribucionPorNombreMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, fecha: '2026-11-20', salones: [{ salonId: 2 }] });

    expect(respuesta.status).toBe(200);
    expect(quitarMock).toHaveBeenCalledWith(20, [2], undefined);
    expect(quitarMock.mock.invocationCallOrder[0]!).toBeLessThan(
      actualizarEventoMock.mock.invocationCallOrder[0]!,
    );
    expect(actualizarEventoMock.mock.invocationCallOrder[0]!).toBeLessThan(
      reemplazarSalonesDelEventoMock.mock.invocationCallOrder[0]!,
    );
  });

  it('responde 409 si la fecha o el salón nuevos pisan a otro evento reservado (RN-12)', async () => {
    vi.mocked(repo.crearEnTransaccion).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'conflicting key value violates exclusion constraint',
        {
          code: 'P2039',
          clientVersion: 'test',
          meta: { driverAdapterError: { cause: { code: '23P01' } } },
        },
      ),
    );

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, fecha: '2026-11-20' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
  });

  it('un presupuesto Confirmado de un evento Cancelado no se modifica (409)', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(confirmada({ estado: 'Cancelado' }));

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(409);
  });

  // HU-27 del Sprint 4 (RN-09): el plazo de 7 días es solo para el cliente. El personal modifica
  // un evento reservado aunque falte un día.
  describe('a menos de 7 días del evento (HU-27)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-14T15:00:00.000Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('el Responsable de Eventos cambia la cantidad de personas igual', async () => {
      // La cookie se firma con el reloj ya movido: la de arriba vencería en esta fecha.
      const respuesta = await request(app)
        .patch('/api/presupuestos/31')
        .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
        .send({
          ...bodyBase,
          fecha: '2026-11-15',
          cantidadPersonas: 10,
          servicios: [{ servicioId: 1, cantidad: 10 }],
        });

      expect(respuesta.status).toBe(200);
      expect(datosDelEvento()).toMatchObject({ cantidadPersonas: 10, estado: 'Reservado' });
    });
  });

  // HU-27 del Sprint 4: solo el personal modifica eventos.
  it('sin sesión responde 401 y con sesión de Cliente 403, sin modificar nada', async () => {
    const sinSesion = await request(app).patch('/api/presupuestos/31').send(bodyBase);
    const comoCliente = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodyBase);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(actualizarEventoMock).not.toHaveBeenCalled();
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
        salones: [],
        tipo: 'Social',
        tipoSocial: 'Casamiento',
        tipoJornada: 'media',
        horaInicioEstimada: '21:00',
        ...evento,
      },
    );
  const bodySocial = {
    fecha: '2026-11-20',
    salones: [],
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
      salones: [],
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
      .send({ ...bodySocial, salones: [{ salonId: 5 }], cantidadPersonas: 12 });

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
      .send({
        ...bodySocial,
        tipo: 'Corporativo',
        salones: [{ salonId: 5 }],
        cantidadPersonas: 12,
      });
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
    expect(respuesta.body.error.message).toBe('Un evento corporativo necesita al menos un salón');
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

// HU-22 (construida en el Sprint 2 como parte de HU-12): dar de baja un presupuesto que el cliente
// no va a confirmar. Los CP-22-xx de la Definición del Producto se cubren por criterio.
describe('POST /api/presupuestos/:id/dar-de-baja (HU-22)', () => {
  function darDeBaja(cookie = cookieRE) {
    return request(app).post('/api/presupuestos/31/dar-de-baja').set('Cookie', [cookie]);
  }

  it.each(['Estimado', 'Expirado'])(
    'pasa un presupuesto %s a Cancelado y cancela su evento (un presupuesto por evento)',
    async (estado) => {
      buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({ estado }));

      const respuesta = await darDeBaja();

      expect(respuesta.status).toBe(200);
      expect(actualizarPresupuestoMock).toHaveBeenCalledWith(
        31,
        { estado: 'Cancelado' },
        undefined,
      );
      expect(actualizarEventoMock).toHaveBeenCalledWith(20, { estado: 'Cancelado' }, undefined);
    },
  );

  it('no borra nada: solo cambia los estados y deja las líneas y los pagos como estaban (RN-06)', async () => {
    await darDeBaja();

    expect(actualizarPresupuestoMock).toHaveBeenCalledTimes(1);
    expect(actualizarEventoMock).toHaveBeenCalledTimes(1);
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
    expect(reemplazarSalonesDelEventoMock).not.toHaveBeenCalled();
  });

  it('responde 409 si el presupuesto está Confirmado: un evento reservado se cancela por HU-23', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({ estado: 'Confirmado' }, { estado: 'Reservado' }),
    );

    const respuesta = await darDeBaja();

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
  });

  it.each(['Reservado', 'Cobrado'])(
    'un presupuesto sobrante de un evento %s se da de baja solo, sin tocar el evento',
    async (estadoEvento) => {
      buscarPresupuestoDetalladoMock.mockResolvedValue(
        consulta({ estado: 'Expirado' }, { estado: estadoEvento }),
      );

      const respuesta = await darDeBaja();

      expect(respuesta.status).toBe(200);
      expect(actualizarPresupuestoMock).toHaveBeenCalledWith(31, { estado: 'Cancelado' });
      expect(actualizarEventoMock).not.toHaveBeenCalled();
    },
  );

  it('responde 409 si el presupuesto ya está Cancelado', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({ estado: 'Cancelado' }, { estado: 'Cancelado' }),
    );

    const respuesta = await darDeBaja();

    expect(respuesta.status).toBe(409);
    expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
  });

  it('responde 409 si el evento está Cancelado', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({}, { estado: 'Cancelado' }));

    const respuesta = await darDeBaja();

    expect(respuesta.status).toBe(409);
    expect(actualizarEventoMock).not.toHaveBeenCalled();
  });

  it('responde 404 si el presupuesto no existe', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(null as never);

    const respuesta = await darDeBaja();

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const sinSesion = await request(app).post('/api/presupuestos/31/dar-de-baja');
    const cliente = await darDeBaja(cookieDe('CLIENTE'));

    expect(sinSesion.status).toBe(401);
    expect(cliente.status).toBe(403);
    expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
  });

  it('cualquier rol del personal puede dar de baja', async () => {
    const respuesta = await darDeBaja(cookieDe('RESPONSABLE_FINANZAS'));

    expect(respuesta.status).toBe(200);
  });

  it('el presupuesto Cancelado se sigue consultando en su detalle', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({ estado: 'Cancelado' }, { estado: 'Cancelado' }),
    );

    const respuesta = await request(app).get('/api/presupuestos/31').set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ estado: 'Cancelado', total: '222200.00' });
  });

  it('el presupuesto Cancelado no se modifica ni se recalcula: responde 409', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({ estado: 'Cancelado' }, { estado: 'Cancelado' }),
    );

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send(bodyBase);

    expect(respuesta.status).toBe(409);
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
    expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
  });
});

// El tacho del listado de consultas (decisión de Franco, 16/10/2026): saca del listado un
// presupuesto Cancelado sin borrarlo, porque HU-22 pide conservarlo.
describe('POST /api/presupuestos/:id/ocultar', () => {
  function ocultar(cookie = cookieRE) {
    return request(app).post('/api/presupuestos/31/ocultar').set('Cookie', [cookie]);
  }

  it('marca ocultoEn en un presupuesto Cancelado y responde 204 sin cuerpo', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({ estado: 'Cancelado' }, { estado: 'Cancelado' }),
    );

    const respuesta = await ocultar();

    expect(respuesta.status).toBe(204);
    expect(respuesta.body).toEqual({});
    expect(actualizarPresupuestoMock).toHaveBeenCalledWith(31, { ocultoEn: expect.any(Date) });
  });

  it('no borra nada: no toca el evento, las líneas ni los salones', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({ estado: 'Cancelado' }, { estado: 'Cancelado' }),
    );

    await ocultar();

    expect(actualizarEventoMock).not.toHaveBeenCalled();
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
    expect(reemplazarSalonesDelEventoMock).not.toHaveBeenCalled();
  });

  it('ocultar uno ya oculto responde 204 y no lo vuelve a escribir', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({ estado: 'Cancelado', ocultoEn: new Date() }, { estado: 'Cancelado' }),
    );

    const respuesta = await ocultar();

    expect(respuesta.status).toBe(204);
    expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
  });

  it.each(['Estimado', 'Expirado', 'Confirmado'])(
    'responde 409 con un presupuesto %s: solo se ocultan los Cancelados',
    async (estado) => {
      buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({ estado }));

      const respuesta = await ocultar();

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('CONFLICT');
      expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
    },
  );

  it('responde 404 si el presupuesto no existe', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(null as never);

    const respuesta = await ocultar();

    expect(respuesta.status).toBe(404);
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const sinSesion = await request(app).post('/api/presupuestos/31/ocultar');
    const cliente = await ocultar(cookieDe('CLIENTE'));

    expect(sinSesion.status).toBe(401);
    expect(cliente.status).toBe(403);
    expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
  });
});

// Seguimiento con el cliente: el aviso de recepción por WhatsApp y el envío formal del PDF. Sin
// aviso, la consulta se lista como «Nuevo».
describe('PATCH /api/presupuestos/:id/seguimiento', () => {
  function seguimiento(cuerpo: object, cookie = cookieRE) {
    return request(app)
      .patch('/api/presupuestos/31/seguimiento')
      .set('Cookie', [cookie])
      .send(cuerpo);
  }

  it('tilda el aviso con la fecha de ahora y devuelve la consulta', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta());

    const respuesta = await seguimiento({ avisoRecepcion: true });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.id).toBe(31);
    expect(actualizarPresupuestoMock).toHaveBeenCalledWith(31, {
      avisoRecepcionEn: expect.any(Date),
      envioFormalEn: undefined,
    });
  });

  it('tildar algo ya tildado conserva la fecha original', async () => {
    const avisadoEn = new Date('2026-10-18T13:00:00.000Z');
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({ avisoRecepcionEn: avisadoEn }));

    await seguimiento({ avisoRecepcion: true, envioFormal: true });

    expect(actualizarPresupuestoMock).toHaveBeenCalledWith(31, {
      avisoRecepcionEn: avisadoEn,
      envioFormalEn: expect.any(Date),
    });
  });

  it('destildar lo deja en null', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({ envioFormalEn: new Date('2026-10-18T13:00:00.000Z') }),
    );

    await seguimiento({ envioFormal: false });

    expect(actualizarPresupuestoMock).toHaveBeenCalledWith(31, {
      avisoRecepcionEn: undefined,
      envioFormalEn: null,
    });
  });

  it('responde 400 si no viene ningún cambio', async () => {
    const respuesta = await seguimiento({});

    expect(respuesta.status).toBe(400);
    expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
  });

  it('responde 404 si el presupuesto no existe', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(null);

    const respuesta = await seguimiento({ avisoRecepcion: true });

    expect(respuesta.status).toBe(404);
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const sinSesion = await request(app)
      .patch('/api/presupuestos/31/seguimiento')
      .send({ avisoRecepcion: true });
    const cliente = await seguimiento({ avisoRecepcion: true }, cookieDe('CLIENTE'));

    expect(sinSesion.status).toBe(401);
    expect(cliente.status).toBe(403);
    expect(actualizarPresupuestoMock).not.toHaveBeenCalled();
  });
});

// Hora esperada de cada servicio dentro del horario del evento. Es opcional: la elige el cliente en
// el cotizador o el personal al armar el presupuesto, y solo se puede controlar contra el horario
// cuando el evento ya está agendado (mientras está EnConsulta, inicio y fin son null).
describe('PATCH /api/presupuestos/:id — hora esperada de cada servicio', () => {
  const lineasGuardadas = () => reemplazarLineasMock.mock.calls[0]![1];
  // 12:00 a 18:00 en Córdoba (UTC-3), para que el control no dependa de la zona del servidor.
  const agendado = {
    inicio: new Date('2026-11-15T15:00:00.000Z'),
    fin: new Date('2026-11-15T21:00:00.000Z'),
  };

  it('guarda la hora del servicio y la del adicional', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        servicios: [{ servicioId: 1, cantidad: 12, horaEstimada: '16:30' }],
        adicionales: [
          {
            descripcion: 'Barra de tragos',
            cantidad: 1,
            precioUnitario: '40000',
            horaEstimada: '21:00',
          },
        ],
      });

    expect(respuesta.status).toBe(200);
    expect(lineasGuardadas()[1]).toMatchObject({ servicioId: 1, horaEstimada: '16:30' });
    expect(lineasGuardadas()[2]).toMatchObject({
      descripcion: 'Barra de tragos',
      horaEstimada: '21:00',
    });
  });

  it('la línea del salón nunca lleva hora', async () => {
    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 12, horaEstimada: '16:30' }] });

    expect(lineasGuardadas()[0]).toMatchObject({ servicioId: null, horaEstimada: null });
  });

  it('sin hora la línea queda sin hora, aunque antes tuviera una', async () => {
    await request(app).patch('/api/presupuestos/31').set('Cookie', [cookieRE]).send(bodyBase);

    expect(lineasGuardadas()[1]).toMatchObject({ servicioId: 1, horaEstimada: null });
  });

  it('acepta cualquier hora mientras el evento no esté agendado', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 12, horaEstimada: '23:45' }] });

    expect(respuesta.status).toBe(200);
    expect(lineasGuardadas()[1]).toMatchObject({ horaEstimada: '23:45' });
  });

  it('acepta una hora dentro del horario del evento agendado', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({}, agendado));

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 12, horaEstimada: '14:00' }] });

    expect(respuesta.status).toBe(200);
  });

  it('responde 422 si la hora cae fuera del horario del evento agendado', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({}, agendado));

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 12, horaEstimada: '10:30' }] });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(respuesta.body.error.message).toContain('12:00');
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  it('responde 400 si la hora no tiene formato HH:mm', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 12, horaEstimada: '25:99' }] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ADR 0011: el panel también puede poner varios salones, incluso los cinco.
describe('PATCH /api/presupuestos/:id — varios salones', () => {
  const lineasGuardadas = () => reemplazarLineasMock.mock.calls[0]![1];
  const pucara = { ...salonParana, id: 2, nombre: 'Pucará' };

  it('emite una línea por salón y deja el resto de las líneas después', async () => {
    buscarSalonesPorIdsMock.mockResolvedValue([salonParana, pucara]);

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, salones: [{ salonId: 5 }, { salonId: 2 }] });

    expect(respuesta.status).toBe(200);
    expect(lineasGuardadas().map((l) => l.salonId)).toEqual([5, 2, null]);
    expect(lineasGuardadas()[1]).toMatchObject({ descripcion: 'Salón Pucará (jornada completa)' });
  });

  it('el salón que ya estaba conserva su precio congelado y el nuevo toma el vigente', async () => {
    buscarSalonesPorIdsMock.mockResolvedValue([salonParana, pucara]);

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, salones: [{ salonId: 5 }, { salonId: 2 }] });

    // Paraná venía congelado en 142200 aunque hoy valga 150000; Pucará entra con el vigente.
    expect(lineasGuardadas()[0]).toMatchObject({ precioUnitario: '142200.00' });
    expect(lineasGuardadas()[1]).toMatchObject({ precioUnitario: '150000.00' });
  });

  it('deja al evento con exactamente los salones enviados', async () => {
    buscarSalonesPorIdsMock.mockResolvedValue([salonParana, pucara]);

    await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, salones: [{ salonId: 2 }] });

    const [eventoId, salones] = reemplazarSalonesDelEventoMock.mock.calls[0]!;
    expect(eventoId).toBe(20);
    expect(salones).toEqual([2]);
  });

  it('responde 400 si el mismo salón viene dos veces', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, salones: [{ salonId: 5 }, { salonId: 5 }] });

    expect(respuesta.status).toBe(400);
    expect(reemplazarSalonesDelEventoMock).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/presupuestos/:id — modalidad (RN-11) y proyección (RN-13)', () => {
  const lineasGuardadas = () => reemplazarLineasMock.mock.calls[0]![1];
  const obtenerPorcentajeMensualMock = vi.mocked(repo.obtenerPorcentajeMensual);
  const coffeeConModalidad = servicio({
    id: 1,
    nombre: 'Coffee Refresh',
    precio: '8730',
    admiteModalidad: true,
  });
  const lunch = servicio({ id: 3, nombre: 'Lunch', precio: '1000' });
  const audiovisual = servicio({ id: 4, nombre: 'Audiovisual', precio: '1000', tercerizado: true });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T15:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rechaza con 422 una modalidad en un servicio que no la admite', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 12, modalidad: 'Continuo' }] });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  it('suma el recargo sobre el precio base congelado al cambiar la modalidad', async () => {
    buscarServiciosPorIdsMock.mockResolvedValue([coffeeConModalidad]);

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 12, modalidad: 'EnMesa' }] });

    expect(respuesta.status).toBe(200);
    // 8000 congelado + 30% = 10400, no los 8730 del catálogo.
    expect(lineasGuardadas()[1]).toMatchObject({
      modalidad: 'EnMesa',
      precioBase: '8000.00',
      precioUnitario: '10400.00',
      subtotal: '124800.00',
    });
  });

  it('proyecta a la fecha del evento el precio de un servicio nuevo, pero no el de un tercerizado', async () => {
    obtenerPorcentajeMensualMock.mockResolvedValue('10');
    buscarServiciosPorIdsMock.mockResolvedValue([lunch, audiovisual]);

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        // Dos meses después del actual: 1000 × 1.1 × 1.1.
        fecha: '2026-12-05',
        servicios: [
          { servicioId: 3, cantidad: 5 },
          { servicioId: 4, cantidad: 1 },
        ],
      });

    expect(respuesta.status).toBe(200);
    expect(lineasGuardadas()[1]).toMatchObject({ servicioId: 3, precioUnitario: '1210.00' });
    expect(lineasGuardadas()[2]).toMatchObject({ servicioId: 4, precioUnitario: '1000.00' });
    obtenerPorcentajeMensualMock.mockResolvedValue('0');
  });

  it('acepta el mismo servicio dos veces con distinta modalidad y cada línea conserva su base', async () => {
    buscarServiciosPorIdsMock.mockResolvedValue([coffeeConModalidad]);
    const base = consulta() as unknown as { lineas: Record<string, unknown>[] };
    buscarPresupuestoDetalladoMock.mockResolvedValue(
      consulta({
        lineas: [
          ...base.lineas,
          {
            ...base.lineas[1],
            id: 3,
            modalidad: 'Continuo',
            precioBase: D('7000'),
            precioUnitario: D('8400'),
            subtotal: D('84000'),
          },
        ],
      }),
    );

    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        servicios: [
          { servicioId: 1, cantidad: 12 },
          { servicioId: 1, cantidad: 12, modalidad: 'Continuo' },
        ],
      });

    expect(respuesta.status).toBe(200);
    expect(lineasGuardadas()[1]).toMatchObject({ modalidad: 'Normal', precioUnitario: '8000.00' });
    expect(lineasGuardadas()[2]).toMatchObject({
      modalidad: 'Continuo',
      precioBase: '7000.00',
      precioUnitario: '8400.00',
    });
  });

  it('responde 400 si el mismo servicio viene dos veces con la misma modalidad', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .send({
        ...bodyBase,
        servicios: [
          { servicioId: 1, cantidad: 12, modalidad: 'Continuo' },
          { servicioId: 1, cantidad: 5, modalidad: 'Continuo' },
        ],
      });

    expect(respuesta.status).toBe(400);
  });
});

// HU-27 / HU-12: validación de la entrada del PATCH y casos límite de los números. El PATCH manda el
// estado completo de la consulta, así que cada campo mal formado se corta con 400 antes de calcular.
describe('PATCH /api/presupuestos/:id — validación de la entrada y bordes', () => {
  const modificar = (cuerpo: object, id = 31) =>
    request(app).patch(`/api/presupuestos/${id}`).set('Cookie', [cookieRE]).send(cuerpo);
  const lineasGuardadas = () => reemplazarLineasMock.mock.calls[0]![1];

  it.each([
    ['en cero', 0],
    ['negativa', -1],
    ['decimal', 12.5],
    ['como texto', '12'],
    ['nula', null],
    ['de 501, por encima del tope de 500', 501],
    ['enorme', 1_000_000],
  ])('una cantidad de personas %s responde 400 y no escribe', async (_caso, cantidadPersonas) => {
    const respuesta = await modificar({ ...bodyBase, servicios: [], cantidadPersonas });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('cantidadPersonas');
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  it('acepta una persona y el tope de 500', async () => {
    const una = await modificar({ ...bodyBase, servicios: [], cantidadPersonas: 1 });
    const tope = await modificar({ ...bodyBase, servicios: [], cantidadPersonas: 500 });

    expect(una.status).toBe(200);
    expect(tope.status).toBe(200);
  });

  it.each([
    ['imposible', '2026-02-30'],
    ['con otro formato', '15/11/2026'],
    ['con hora', '2026-11-15T10:00:00Z'],
    ['vacía', ''],
    ['nula', null],
    ['numérica', 20261115],
  ])('una fecha %s responde 400 y no escribe', async (_caso, fecha) => {
    const respuesta = await modificar({ ...bodyBase, fecha });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('fecha');
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  it.each([
    ['en cero', 0],
    ['negativa', -3],
    ['decimal', 1.5],
    ['como texto', '3'],
    ['nula', null],
  ])('una cantidad de servicio %s responde 400 y no escribe', async (_caso, cantidad) => {
    const respuesta = await modificar({ ...bodyBase, servicios: [{ servicioId: 1, cantidad }] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('servicios.0.cantidad');
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  it.each([
    ['en cero', 0],
    ['negativo', -1],
    ['decimal', 1.5],
    ['como texto', '1'],
  ])('un id de servicio %s responde 400', async (_caso, servicioId) => {
    const respuesta = await modificar({ ...bodyBase, servicios: [{ servicioId, cantidad: 3 }] });

    expect(respuesta.status).toBe(400);
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  it.each([
    ['con letras', 'abc'],
    ['negativo', '-1'],
    ['con tres decimales', '10.123'],
    ['con coma', '10,50'],
    ['numérico', 10],
  ])('un precio ajustado de servicio %s responde 400', async (_caso, precioUnitario) => {
    const respuesta = await modificar({
      ...bodyBase,
      servicios: [{ servicioId: 1, cantidad: 3, precioUnitario }],
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('servicios.0.precioUnitario');
  });

  it.each([
    ['de cantidad cero', { descripcion: 'Flores', cantidad: 0, precioUnitario: '100' }],
    ['de cantidad decimal', { descripcion: 'Flores', cantidad: 1.5, precioUnitario: '100' }],
    ['con precio negativo', { descripcion: 'Flores', cantidad: 1, precioUnitario: '-100' }],
    [
      'con precio de tres decimales',
      { descripcion: 'Flores', cantidad: 1, precioUnitario: '1.234' },
    ],
    [
      'con descripción de solo espacios',
      { descripcion: '   ', cantidad: 1, precioUnitario: '100' },
    ],
    [
      'con descripción de 121 caracteres',
      { descripcion: 'a'.repeat(121), cantidad: 1, precioUnitario: '100' },
    ],
    [
      'con HTML en la descripción',
      { descripcion: '<b>Flores</b>', cantidad: 1, precioUnitario: '100' },
    ],
  ])('un adicional %s responde 400 y no escribe', async (_caso, adicional) => {
    const respuesta = await modificar({ ...bodyBase, adicionales: [adicional] });

    expect(respuesta.status).toBe(400);
    // Zod y el middleware de HTML nombran el campo igual: `adicionales.0.x`.
    expect(respuesta.body.error.details[0].campo).toMatch(/^adicionales\.0\./);
    expect(reemplazarLineasMock).not.toHaveBeenCalled();
  });

  // El PO decidió que un adicional puede valer $0, como cortesía (08/11/2026): se carga en el
  // presupuesto, sale en el detalle y no suma al total.
  it('un adicional de $0 se acepta como cortesía y no suma al total', async () => {
    const respuesta = await modificar({
      ...bodyBase,
      adicionales: [{ descripcion: 'Brindis de cortesía', cantidad: 12, precioUnitario: '0' }],
    });

    expect(respuesta.status).toBe(200);
    const cortesia = lineasGuardadas().find((l) => l.descripcion === 'Brindis de cortesía');
    expect(cortesia).toMatchObject({
      servicioId: null,
      salonId: null,
      cantidad: 12,
      precioUnitario: '0.00',
      subtotal: '0.00',
      aCotizar: false,
    });
    // Lo mismo que sin el adicional: 142200 (salón) + 96000 (12 coffees a 8000).
    expect((actualizarPresupuestoMock.mock.calls[0]![1] as { total: string }).total).toBe(
      '238200.00',
    );
  });

  it('un adicional de $0 no se confunde con uno a cotizar: es una línea con precio', async () => {
    await modificar({
      ...bodyBase,
      adicionales: [{ descripcion: 'Brindis de cortesía', cantidad: 1, precioUnitario: '0.00' }],
    });

    const cortesia = lineasGuardadas().find((l) => l.descripcion === 'Brindis de cortesía');
    expect(cortesia?.aCotizar).toBe(false);
  });

  it('un adicional de $0 junto a uno con precio suma solo el que tiene precio', async () => {
    await modificar({
      ...bodyBase,
      adicionales: [
        { descripcion: 'Brindis de cortesía', cantidad: 12, precioUnitario: '0' },
        { descripcion: 'Centros de mesa', cantidad: 4, precioUnitario: '1500' },
      ],
    });

    expect((actualizarPresupuestoMock.mock.calls[0]![1] as { total: string }).total).toBe(
      '244200.00',
    );
  });

  it('un adicional con la descripción de exactamente 120 caracteres se acepta', async () => {
    const respuesta = await modificar({
      ...bodyBase,
      adicionales: [{ descripcion: 'a'.repeat(120), cantidad: 1, precioUnitario: '100' }],
    });

    expect(respuesta.status).toBe(200);
  });

  it.each([
    ['de media noche', '24:00'],
    ['con minutos imposibles', '10:60'],
    ['sin cero adelante', '9:30'],
    ['con segundos', '10:30:00'],
    ['en texto', 'mediodía'],
  ])('una hora %s en un servicio responde 400', async (_caso, horaEstimada) => {
    const respuesta = await modificar({
      ...bodyBase,
      servicios: [{ servicioId: 1, cantidad: 3, horaEstimada }],
    });

    expect(respuesta.status).toBe(400);
  });

  it.each(['00:00', '09:05', '23:59'])('acepta la hora %s en un servicio', async (horaEstimada) => {
    const respuesta = await modificar({
      ...bodyBase,
      servicios: [{ servicioId: 1, cantidad: 3, horaEstimada }],
    });

    expect(respuesta.status).toBe(200);
  });

  it('una jornada que no es completa ni media responde 400', async () => {
    const respuesta = await modificar({ ...bodyBase, tipoJornada: 'noche' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('tipoJornada');
  });

  it('un body vacío responde 400 con fecha, cantidad de personas y jornada', async () => {
    const respuesta = await modificar({});

    expect(respuesta.status).toBe(400);
    const campos = respuesta.body.error.details.map((detalle: { campo: string }) => detalle.campo);
    expect(campos).toEqual(expect.arrayContaining(['fecha', 'cantidadPersonas', 'tipoJornada']));
  });

  it('un JSON malformado responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .patch('/api/presupuestos/31')
      .set('Cookie', [cookieRE])
      .set('Content-Type', 'application/json')
      .send('{"fecha": "2026-11-15", ');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('con un id de presupuesto que no es entero positivo responde 400 sin consultar', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const respuesta = await request(app)
        .patch(`/api/presupuestos/${id}`)
        .set('Cookie', [cookieRE])
        .send(bodyBase);
      expect(respuesta.status, id).toBe(400);
    }
    expect(buscarPresupuestoDetalladoMock).not.toHaveBeenCalled();
  });

  it('el body no puede cambiar la marca de factura, el estado ni el total del presupuesto', async () => {
    await modificar({ ...bodyBase, requiereFactura: true, estado: 'Confirmado', total: '1' });

    const datos = actualizarPresupuestoMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(datos).not.toHaveProperty('requiereFactura');
    expect(datos['estado']).toBe('Estimado');
    expect(datos['total']).toBe('238200.00');
  });

  // Dinero: los importes se suman como decimales exactos, sin errores de punto flotante.
  it('suma los centavos sin error de redondeo (0,1 × 3 no da 0,30000000000000004)', async () => {
    const barato = servicio({ id: 3, nombre: 'Gaseosa', precio: '0.10' });
    buscarServiciosPorIdsMock.mockResolvedValue([coffee, barato]);

    const respuesta = await modificar({
      ...bodyBase,
      servicios: [
        { servicioId: 1, cantidad: 12 },
        { servicioId: 3, cantidad: 3 },
      ],
    });

    expect(respuesta.status).toBe(200);
    // 142200 (salón congelado) + 12 × 8000 (coffee congelado) + 3 × 0,10.
    expect((actualizarPresupuestoMock.mock.calls[0]![1] as { total: string }).total).toBe(
      '238200.30',
    );
  });

  it('un precio con centavos por cantidad queda exacto al centavo', async () => {
    const raro = servicio({ id: 3, nombre: 'Postre', precio: '1234.56' });
    buscarServiciosPorIdsMock.mockResolvedValue([coffee, raro]);

    const respuesta = await modificar({
      ...bodyBase,
      servicios: [
        { servicioId: 1, cantidad: 12 },
        { servicioId: 3, cantidad: 7 },
      ],
    });

    expect(respuesta.status).toBe(200);
    // 142200 + 96000 + 7 × 1234,56 (= 8641,92)
    expect((actualizarPresupuestoMock.mock.calls[0]![1] as { total: string }).total).toBe(
      '246841.92',
    );
  });
});
