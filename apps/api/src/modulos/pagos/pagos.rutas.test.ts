import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

vi.mock('./pagos.repositorio.js', () => ({
  buscarDetallado: vi.fn(),
  buscarSolapamiento: vi.fn(),
  listarDeEvento: vi.fn(),
  sumarPagos: vi.fn(),
  buscarMedioPagoActivo: vi.fn(),
  listarMediosPagoActivos: vi.fn(),
  crear: vi.fn(),
  confirmarPresupuestoYReservar: vi.fn(),
  marcarCobrado: vi.fn(),
  buscarConsultasSuperpuestas: vi.fn(),
  // No hay transacción real en el test: se ejecuta el callback tal cual. Las escrituras de adentro
  // ya están mockeadas y no usan el `tx` que recibirían de una transacción real.
  crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
}));

const {
  buscarDetallado,
  buscarSolapamiento,
  listarDeEvento,
  sumarPagos,
  buscarMedioPagoActivo,
  listarMediosPagoActivos,
  crear,
  confirmarPresupuestoYReservar,
  marcarCobrado,
  buscarConsultasSuperpuestas,
} = await import('./pagos.repositorio.js');

const buscarDetalladoMock = vi.mocked(buscarDetallado);
const buscarSolapamientoMock = vi.mocked(buscarSolapamiento);
const listarDeEventoMock = vi.mocked(listarDeEvento);
const sumarPagosMock = vi.mocked(sumarPagos);
const buscarMedioPagoActivoMock = vi.mocked(buscarMedioPagoActivo);
const listarMediosPagoActivosMock = vi.mocked(listarMediosPagoActivos);
const crearMock = vi.mocked(crear);
const confirmarPresupuestoYReservarMock = vi.mocked(confirmarPresupuestoYReservar);
const marcarCobradoMock = vi.mocked(marcarCobrado);
const buscarConsultasSuperpuestasMock = vi.mocked(buscarConsultasSuperpuestas);

const app = crearApp();

// El total del presupuesto está sin IVA (RN-05). De ahí salen las dos bases de cobro de RN-01:
//   sin factura → 142200       → 20% = 28440
//   con factura → 142200 * 1,21 = 172062 → 20% = 34412,40
const TOTAL_SIN_IVA = '142200';
const SENA_SIN_FACTURA = '28440';
const SENA_CON_FACTURA = '34412.40';
const BASE_CON_FACTURA = '172062.00';

const salonFixture = {
  id: 5,
  nombre: 'Paraná',
  capacidadMaxima: 300,
  superficie: 400,
  precioJornadaCompleta: new Prisma.Decimal('142200'),
  precioMediaJornada: new Prisma.Decimal('107900'),
  visibleEnLanding: true,
  fotoUrl: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const clienteFixture = {
  id: 10,
  nombre: 'Marina',
  apellido: 'Gómez',
  telefono: '+54 9 351 555-1234',
  correo: 'marina@example.com',
  activo: true,
  usuarioId: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const distribucionFixture = {
  id: 3,
  salonId: salonFixture.id,
  nombre: 'Conferencia',
  capacidad: 280,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const medioPagoFixture = {
  id: 1,
  nombre: 'Efectivo',
  activo: true,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const lineaFixture = {
  id: 1,
  presupuestoId: 30,
  servicioId: null,
  descripcion: `Salón ${salonFixture.nombre} (jornada completa)`,
  cantidad: 1,
  precioUnitario: new Prisma.Decimal(TOTAL_SIN_IVA),
  subtotal: new Prisma.Decimal(TOTAL_SIN_IVA),
  aCotizar: false,
};

type EstadoPresupuestoFixture = 'Estimado' | 'Confirmado' | 'Cancelado' | 'Expirado';

function presupuestoFixture(
  datos: { estado?: EstadoPresupuestoFixture; requiereFactura?: boolean } = {},
) {
  return {
    id: 30,
    eventoId: 20,
    estado: (datos.estado ?? 'Estimado') as EstadoPresupuestoFixture,
    fechaEmision: new Date(),
    venceEn: new Date(),
    total: new Prisma.Decimal(TOTAL_SIN_IVA),
    requiereFactura: datos.requiereFactura ?? false,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    lineas: [lineaFixture],
  };
}

type EstadoEventoFixture = 'EnConsulta' | 'Reservado' | 'Cobrado' | 'Cancelado';

const inicioFixture = new Date('2026-11-15T20:00:00.000Z');
const finFixture = new Date('2026-11-16T02:00:00.000Z');

// Evento ya agendado (distribución y franja cargadas), que es el caso normal cuando llega el pago.
function eventoFixtureBase() {
  return {
    id: 20,
    clienteId: clienteFixture.id,
    salonId: salonFixture.id as number | null,
    distribucionId: distribucionFixture.id as number | null,
    fecha: new Date('2026-11-15'),
    inicio: inicioFixture as Date | null,
    fin: finFixture as Date | null,
    cantidadPersonas: 10,
    estado: 'EnConsulta' as EstadoEventoFixture,
    senaVenceEn: null as Date | null,
    senaRegistradaEn: null as Date | null,
    tipo: 'Corporativo' as 'Social' | 'Corporativo',
    tipoSocial: null,
    tipoSocialDetalle: null as string | null,
    tipoJornada: null,
    horaInicioEstimada: null as string | null,
    modalidadSalonRestaurante: false,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    cliente: clienteFixture,
    salon: salonFixture,
    distribucion: distribucionFixture as typeof distribucionFixture | null,
    solicitud: null,
    presupuestos: [presupuestoFixture()],
  };
}

function eventoFixture(datos: Partial<ReturnType<typeof eventoFixtureBase>> = {}) {
  return { ...eventoFixtureBase(), ...datos };
}

function pagoFixture(monto: string) {
  return {
    id: 100,
    eventoId: 20,
    fecha: new Date('2026-10-06'),
    monto: new Prisma.Decimal(monto),
    medioPagoId: medioPagoFixture.id,
    observacion: null,
    creadoEn: new Date(),
    medioPago: medioPagoFixture,
  };
}

function cuerpoPago(monto: string) {
  return { fecha: '2026-10-06', monto, medioPagoId: medioPagoFixture.id };
}

const cookieDe = (rol: string, email: string) =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email, rol: rol as 'RESPONSABLE_EVENTOS' })}`;

const cookieResponsableEventos = cookieDe('RESPONSABLE_EVENTOS', 're@confluens.test');

function registrarPago(monto: string, cookie = cookieResponsableEventos) {
  return request(app).post('/api/eventos/20/pagos').set('Cookie', [cookie]).send(cuerpoPago(monto));
}

beforeEach(() => {
  vi.mocked(buscarDetallado).mockReset();
  buscarSolapamientoMock.mockReset();
  listarDeEventoMock.mockReset();
  sumarPagosMock.mockReset();
  buscarMedioPagoActivoMock.mockReset();
  listarMediosPagoActivosMock.mockReset();
  crearMock.mockReset();
  confirmarPresupuestoYReservarMock.mockReset();
  marcarCobradoMock.mockReset();
  buscarConsultasSuperpuestasMock.mockReset();

  buscarDetalladoMock.mockResolvedValue(eventoFixture());
  buscarSolapamientoMock.mockResolvedValue(null);
  sumarPagosMock.mockResolvedValue(null);
  buscarMedioPagoActivoMock.mockResolvedValue(medioPagoFixture);
  buscarConsultasSuperpuestasMock.mockResolvedValue([]);
  crearMock.mockImplementation(async (datos) => ({
    ...pagoFixture(String(datos.monto)),
    observacion: datos.observacion ?? null,
  }));
  confirmarPresupuestoYReservarMock.mockImplementation(async () =>
    eventoFixture({ estado: 'Reservado', senaRegistradaEn: new Date() }),
  );
  marcarCobradoMock.mockImplementation(async () => eventoFixture({ estado: 'Cobrado' }));
});

// RN-01, resolución de S-08: la seña es el 20% de la base de cobro, y la base depende de si el
// presupuesto se factura. Estos dos tests son los que prueban esa resolución.
describe('POST /api/eventos/:id/pagos — base de cobro (RN-01)', () => {
  it('sin requiereFactura, el 20% se calcula sobre el total sin IVA y reserva el salón', async () => {
    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.saldo.baseDeCobro).toBe('142200.00');
    expect(respuesta.body.data.saldo.incluyeIva).toBe(false);
    expect(respuesta.body.data.saldo.porcentajeAbonado).toBe(20);
    expect(respuesta.body.data.reservoElSalon).toBe(true);
    expect(respuesta.body.data.estadoEvento).toBe('Reservado');
  });

  it('con requiereFactura, el 20% se calcula sobre el total con IVA', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ requiereFactura: true })] }),
    );

    const respuesta = await registrarPago(SENA_CON_FACTURA);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.saldo.baseDeCobro).toBe(BASE_CON_FACTURA);
    expect(respuesta.body.data.saldo.incluyeIva).toBe(true);
    expect(respuesta.body.data.saldo.porcentajeAbonado).toBe(20);
    expect(respuesta.body.data.reservoElSalon).toBe(true);
  });

  it('con requiereFactura, el 20% del total SIN IVA no alcanza para reservar', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ requiereFactura: true })] }),
    );

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.reservoElSalon).toBe(false);
    expect(respuesta.body.data.estadoEvento).toBe('EnConsulta');
    expect(confirmarPresupuestoYReservarMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/eventos/:id/pagos — transiciones de estado (HU-13)', () => {
  it('un pago que no llega al 20% registra la plata y deja el evento EnConsulta', async () => {
    const respuesta = await registrarPago('14220'); // 10%

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.estadoEvento).toBe('EnConsulta');
    expect(respuesta.body.data.saldo.pagado).toBe('14220.00');
    expect(respuesta.body.data.saldo.saldo).toBe('127980.00');
    expect(respuesta.body.data.saldo.porcentajeAbonado).toBe(10);
    expect(crearMock).toHaveBeenCalledTimes(1);
    expect(confirmarPresupuestoYReservarMock).not.toHaveBeenCalled();
    expect(marcarCobradoMock).not.toHaveBeenCalled();
  });

  it('acumula con los pagos anteriores: dos del 10% cruzan el 20% y reservan', async () => {
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal('14220'));

    const respuesta = await registrarPago('14220');

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.estadoEvento).toBe('Reservado');
    expect(confirmarPresupuestoYReservarMock).toHaveBeenCalledWith(
      { eventoId: 20, presupuestoId: 30 },
      undefined,
    );
  });

  it('el pago que cruza el 20% confirma el presupuesto y escribe senaRegistradaEn', async () => {
    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(201);
    // La escritura de senaRegistradaEn vive en el repositorio y es parte de esta misma operación.
    expect(confirmarPresupuestoYReservarMock).toHaveBeenCalledTimes(1);
    expect(marcarCobradoMock).not.toHaveBeenCalled();
  });

  it('un pago que completa el 100% sobre un evento ya Reservado lo pasa a Cobrado', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        estado: 'Reservado',
        presupuestos: [presupuestoFixture({ estado: 'Confirmado' })],
      }),
    );
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal(SENA_SIN_FACTURA));

    const respuesta = await registrarPago('113760'); // 142200 - 28440

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.estadoEvento).toBe('Cobrado');
    expect(respuesta.body.data.saldo.saldo).toBe('0.00');
    expect(respuesta.body.data.saldo.porcentajeAbonado).toBe(100);
    expect(confirmarPresupuestoYReservarMock).not.toHaveBeenCalled();
    expect(marcarCobradoMock).toHaveBeenCalledTimes(1);
  });

  it('un pago único que cruza el 20% y el 100% a la vez aplica las dos transiciones', async () => {
    const respuesta = await registrarPago(TOTAL_SIN_IVA);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.estadoEvento).toBe('Cobrado');
    expect(respuesta.body.data.reservoElSalon).toBe(true);
    expect(confirmarPresupuestoYReservarMock).toHaveBeenCalledTimes(1);
    expect(marcarCobradoMock).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/eventos/:id/pagos — rechazos', () => {
  it('responde 404 si el evento no existe', async () => {
    buscarDetalladoMock.mockResolvedValue(null);

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it.each(['Cancelado', 'Cobrado'] as const)(
    'responde 409 si el evento está %s',
    async (estado) => {
      buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado }));

      const respuesta = await registrarPago('1000');

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('CONFLICT');
      expect(crearMock).not.toHaveBeenCalled();
    },
  );

  it('responde 409 si el evento no tiene un presupuesto vigente', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ presupuestos: [] }));

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearMock).not.toHaveBeenCalled();
  });

  // HU-13 C3 / RN-06. La mitad que produce el estado Expirado es de HU-10: este test es el que
  // deja comprobada la mitad que rechaza el pago, sin depender de que esa historia esté hecha.
  it('responde 409 si el presupuesto vigente está Expirado, pidiendo recalcularlo', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ estado: 'Expirado' })] }),
    );

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(respuesta.body.error.message).toContain('vencido');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('ignora los presupuestos Cancelados al elegir el vigente', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        presupuestos: [
          presupuestoFixture(),
          { ...presupuestoFixture({ estado: 'Cancelado' }), id: 31 },
        ],
      }),
    );

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(201);
    expect(confirmarPresupuestoYReservarMock).toHaveBeenCalledWith(
      { eventoId: 20, presupuestoId: 30 },
      undefined,
    );
  });

  it('responde 404 si el medio de pago no existe o está inactivo', async () => {
    buscarMedioPagoActivoMock.mockResolvedValue(null);

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('responde 422 si el importe supera el saldo: no queda saldo a favor', async () => {
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal('142000'));

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(crearMock).not.toHaveBeenCalled();
  });

  // No se puede reservar sin franja horaria: sin inicio y fin no hay con qué evaluar RN-12.
  it('responde 422 si el pago cruza el 20% y el evento no está agendado', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ inicio: null, fin: null, distribucionId: null, distribucion: null }),
    );

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(respuesta.body.error.message).toContain('agendar');
    expect(crearMock).not.toHaveBeenCalled();
  });

  // ADR 0008: una consulta social puede llegar al pago sin salón cargado.
  it('responde 422 si el pago cruza el 20% y el evento no tiene salón', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ salonId: null }));

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toContain('agendar');
    expect(buscarSolapamientoMock).not.toHaveBeenCalled();
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('acepta un pago chico sobre un evento sin agendar: todavía no tiene que reservar nada', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ inicio: null, fin: null, distribucionId: null, distribucion: null }),
    );

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.estadoEvento).toBe('EnConsulta');
  });

  it('responde 409 si la franja ya está ocupada, nombrando el evento en conflicto (RN-12)', async () => {
    buscarSolapamientoMock.mockResolvedValue(eventoFixture({ id: 55, estado: 'Reservado' }));

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(respuesta.body.error.message).toContain('#55');
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('responde 409 si la constraint EXCLUDE de Postgres detecta una carrera de solapamiento', async () => {
    // Forma real verificada empíricamente (Prisma 7.10.0 + @prisma/adapter-pg): code 'P2039' con
    // el SQLSTATE real (23P01 = exclusion_violation) anidado en meta.driverAdapterError.cause.code.
    confirmarPresupuestoYReservarMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'conflicting key value violates exclusion constraint',
        {
          code: 'P2039',
          clientVersion: 'test',
          meta: { driverAdapterError: { cause: { code: '23P01' } } },
        },
      ),
    );

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
  });

  it.each([
    ['monto en cero', { fecha: '2026-10-06', monto: '0', medioPagoId: 1 }],
    ['monto negativo', { fecha: '2026-10-06', monto: '-100', medioPagoId: 1 }],
    ['fecha inválida', { fecha: '06/10/2026', monto: '1000', medioPagoId: 1 }],
    ['sin medio de pago', { fecha: '2026-10-06', monto: '1000' }],
  ])('responde 400 con %s', async (_caso, cuerpo) => {
    const respuesta = await request(app)
      .post('/api/eventos/20/pagos')
      .set('Cookie', [cookieResponsableEventos])
      .send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });
});

// HU-13 C6: las consultas que pisan la franja no se cancelan (dominio.md:30, Cancelado es siempre
// manual), se informan para que el Responsable de Eventos las gestione.
describe('POST /api/eventos/:id/pagos — consultas en conflicto (HU-13 C6)', () => {
  it('devuelve las consultas superpuestas sin cancelarlas cuando el pago reserva el salón', async () => {
    buscarConsultasSuperpuestasMock.mockResolvedValue([
      {
        id: 77,
        inicio: inicioFixture,
        fin: finFixture,
        cliente: { id: 11, nombre: 'Jorge', apellido: 'Pérez' },
      },
    ]);

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.consultasEnConflicto).toHaveLength(1);
    expect(respuesta.body.data.consultasEnConflicto[0].id).toBe(77);
  });

  it('no las consulta si el pago no reserva el salón', async () => {
    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.consultasEnConflicto).toEqual([]);
    expect(buscarConsultasSuperpuestasMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/eventos/:id/pagos', () => {
  it('devuelve el historial y el saldo actualizado (HU-14 C2)', async () => {
    listarDeEventoMock.mockResolvedValue([pagoFixture('14220'), pagoFixture('14220')]);

    const respuesta = await request(app)
      .get('/api/eventos/20/pagos')
      .set('Cookie', [cookieResponsableEventos]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.pagos).toHaveLength(2);
    expect(respuesta.body.data.saldo.pagado).toBe('28440.00');
    expect(respuesta.body.data.saldo.saldo).toBe('113760.00');
    expect(respuesta.body.data.saldo.porcentajeAbonado).toBe(20);
  });

  it('responde 404 si el evento no existe', async () => {
    buscarDetalladoMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .get('/api/eventos/999/pagos')
      .set('Cookie', [cookieResponsableEventos]);

    expect(respuesta.status).toBe(404);
  });
});

describe('GET /api/medios-pago', () => {
  it('devuelve los medios de pago activos', async () => {
    listarMediosPagoActivosMock.mockResolvedValue([medioPagoFixture]);

    const respuesta = await request(app)
      .get('/api/medios-pago')
      .set('Cookie', [cookieResponsableEventos]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0].nombre).toBe('Efectivo');
  });
});

// HU-14 C7: la lista de roles que pueden registrar un cobro es una decisión explícita del PO.
describe('pagos: permisos (HU-14 C7)', () => {
  it.each([
    ['RESPONSABLE_EVENTOS', 're@confluens.test'],
    ['RESPONSABLE_FINANZAS', 'rf@confluens.test'],
    ['GERENTE_GENERAL', 'gg@confluens.test'],
    ['ADMINISTRADOR_SISTEMA', 'admin@confluens.test'],
  ])('%s puede registrar un pago', async (rol, email) => {
    const respuesta = await registrarPago('1000', cookieDe(rol, email));

    expect(respuesta.status).toBe(201);
  });

  it('un Cliente no puede registrar un pago', async () => {
    const respuesta = await registrarPago('1000', cookieDe('CLIENTE', 'ana@empresa.com'));

    expect(respuesta.status).toBe(403);
    expect(crearMock).not.toHaveBeenCalled();
  });

  it.each([
    ['post', '/api/eventos/20/pagos'],
    ['get', '/api/eventos/20/pagos'],
    ['get', '/api/medios-pago'],
  ] as const)('%s %s sin sesión responde 401', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta);

    expect(respuesta.status).toBe(401);
    expect(crearMock).not.toHaveBeenCalled();
  });
});
