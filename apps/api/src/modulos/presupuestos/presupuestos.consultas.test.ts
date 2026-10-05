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
  contarOtrosPresupuestosVigentes: vi.fn(),
}));

const repo = await import('./presupuestos.repositorio.js');
const buscarSalonMock = vi.mocked(repo.buscarSalon);
const buscarServiciosPorIdsMock = vi.mocked(repo.buscarServiciosPorIds);
const buscarPresupuestoDetalladoMock = vi.mocked(repo.buscarPresupuestoDetallado);
const actualizarEventoMock = vi.mocked(repo.actualizarEvento);
const actualizarPresupuestoMock = vi.mocked(repo.actualizarPresupuesto);
const reemplazarLineasMock = vi.mocked(repo.reemplazarLineas);
const contarOtrosMock = vi.mocked(repo.contarOtrosPresupuestosVigentes);

const app = crearApp();
const D = (valor: string) => new Prisma.Decimal(valor);
const DIEZ_DIAS = 10 * 24 * 60 * 60 * 1000;

function cookieDe(rol: 'RESPONSABLE_EVENTOS' | 'ADMINISTRADOR_SISTEMA' | 'RESPONSABLE_FINANZAS') {
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

function servicio(datos: { id: number; nombre: string; precio: string } & Record<string, unknown>) {
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
    precio: D(datos.precio),
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
  contarOtrosMock.mockResolvedValue(0);
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

  it('responde 404 si el presupuesto no existe', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(null);

    const respuesta = await request(app).get('/api/presupuestos/999').set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(404);
  });

  it('responde 401 sin sesión y 403 con otro rol', async () => {
    expect((await request(app).get('/api/presupuestos/31')).status).toBe(401);
    const conOtroRol = await request(app)
      .get('/api/presupuestos/31')
      .set('Cookie', [cookieDe('RESPONSABLE_FINANZAS')]);
    expect(conOtroRol.status).toBe(403);
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
      },
      {
        servicioId: 1,
        descripcion: 'Coffee Refresh',
        cantidad: 12,
        precioUnitario: '8000.00',
        subtotal: '96000.00',
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

describe('POST /api/presupuestos/:id/dar-de-baja (HU-12)', () => {
  it('pasa la consulta a Cancelado y cancela el evento si no le queda otro presupuesto', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos/31/dar-de-baja')
      .set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(200);
    expect(actualizarPresupuestoMock).toHaveBeenCalledWith(31, { estado: 'Cancelado' }, undefined);
    expect(actualizarEventoMock).toHaveBeenCalledWith(20, { estado: 'Cancelado' }, undefined);
  });

  it('no cancela el evento si le queda otro presupuesto en curso', async () => {
    contarOtrosMock.mockResolvedValue(1);

    await request(app).post('/api/presupuestos/31/dar-de-baja').set('Cookie', [cookieRE]);

    expect(actualizarPresupuestoMock).toHaveBeenCalled();
    expect(actualizarEventoMock).not.toHaveBeenCalled();
  });

  it('responde 409 si el presupuesto está Confirmado', async () => {
    buscarPresupuestoDetalladoMock.mockResolvedValue(consulta({ estado: 'Confirmado' }));

    const respuesta = await request(app)
      .post('/api/presupuestos/31/dar-de-baja')
      .set('Cookie', [cookieRE]);

    expect(respuesta.status).toBe(409);
  });
});
