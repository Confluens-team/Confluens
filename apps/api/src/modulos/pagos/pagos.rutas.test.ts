import request from 'supertest';
import { MEDIOS_PAGO_INICIALES } from '@confluens/shared';
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
  listarTodosLosMediosPago: vi.fn(),
  buscarMedioPagoPorNombre: vi.fn(),
  crearMedioPago: vi.fn(),
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
  listarTodosLosMediosPago,
  buscarMedioPagoPorNombre,
  crearMedioPago,
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
const listarTodosLosMediosPagoMock = vi.mocked(listarTodosLosMediosPago);
const buscarMedioPagoPorNombreMock = vi.mocked(buscarMedioPagoPorNombre);
const crearMedioPagoMock = vi.mocked(crearMedioPago);
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
  etiquetaId: null,
  etiqueta: null,
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
  conFactura: true,
  sinFactura: true,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const lineaFixture = {
  id: 1,
  presupuestoId: 30,
  servicioId: null,
  salonId: salonFixture.id,
  descripcion: `Salón ${salonFixture.nombre} (jornada completa)`,
  cantidad: 1,
  precioUnitario: new Prisma.Decimal(TOTAL_SIN_IVA),
  subtotal: new Prisma.Decimal(TOTAL_SIN_IVA),
  aCotizar: false,
  horaEstimada: null,
};

// El salón del evento sin distribución, como queda antes de agendar.
function salonSinArmar() {
  return { ...eventoFixture().salones[0]!, distribucionId: null, distribucion: null };
}

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
    observacionesComanda: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    cliente: clienteFixture,
    salones: [
      {
        eventoId: 20,
        salonId: salonFixture.id,
        distribucionId: distribucionFixture.id as number | null,
        inicio: null as Date | null,
        fin: null as Date | null,
        estado: 'EnConsulta' as EstadoEventoFixture,
        creadoEn: new Date(),
        salon: salonFixture,
        distribucion: distribucionFixture as typeof distribucionFixture | null,
      },
    ],
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

  // ADR 0011: la seña reserva todos los salones del evento, así que RN-12 se controla en todos.
  // Antes se miraba solo Evento.salonId, y un segundo salón se podía reservar pisado.
  it('al cruzar el 20% controla el solapamiento y los conflictos en todos los salones del evento', async () => {
    const pucara = { ...salonFixture, id: 9, nombre: 'Pucará' };
    const base = eventoFixture();
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        salones: [...base.salones, { ...base.salones[0]!, salonId: pucara.id, salon: pucara }],
      }),
    );

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(201);
    const salonIds = [salonFixture.id, pucara.id];
    expect(buscarSolapamientoMock.mock.calls[0]![0]).toMatchObject({ salonIds });
    expect(buscarConsultasSuperpuestasMock.mock.calls[0]![0]).toMatchObject({ salonIds });
  });

  it('la seña se rechaza si el segundo salón ya está reservado, diciendo cuál', async () => {
    const pucara = { ...salonFixture, id: 9, nombre: 'Pucará' };
    const base = eventoFixture();
    const vinculoPucara = { ...base.salones[0]!, salonId: pucara.id, salon: pucara };
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ salones: [...base.salones, vinculoPucara] }),
    );
    buscarSolapamientoMock.mockResolvedValue(
      eventoFixture({ id: 88, salones: [vinculoPucara] }) as never,
    );

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.message).toBe(
      'El salón Pucará ya está reservado en ese horario por el evento #88',
    );
    expect(confirmarPresupuestoYReservarMock).not.toHaveBeenCalled();
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
      eventoFixture({ inicio: null, fin: null, salones: [salonSinArmar()] }),
    );

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(respuesta.body.error.message).toContain('agendar');
    expect(crearMock).not.toHaveBeenCalled();
  });

  // ADR 0008: una consulta social puede llegar al pago sin salón cargado.
  it('responde 422 si el pago cruza el 20% y el evento no tiene salón', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ salones: [] }));

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toContain('agendar');
    expect(buscarSolapamientoMock).not.toHaveBeenCalled();
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('acepta un pago chico sobre un evento sin agendar: todavía no tiene que reservar nada', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ inicio: null, fin: null, salones: [salonSinArmar()] }),
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
// RN-14: con qué se puede cobrar depende de la casilla «El cliente requiere factura» del
// presupuesto y de la habilitación de cada medio (con factura, sin factura o los dos, HU-19). Del
// catálogo inicial, sin factura solo Efectivo, Transferencia y A la habitación; con factura se suman
// Débito, Crédito y Cheque. La web filtra el desplegable, pero la regla la tiene que sostener la API.
describe('POST /api/eventos/:id/pagos — medios de pago según la factura (RN-14)', () => {
  const catalogo = MEDIOS_PAGO_INICIALES.map((medio, i) => ({
    ...medioPagoFixture,
    ...medio,
    id: i + 1,
  }));

  function conMedio(
    nombre: string,
    requiereFactura: boolean,
    habilitacion: { conFactura: boolean; sinFactura: boolean } = MEDIOS_PAGO_INICIALES.find(
      (m) => m.nombre === nombre,
    ) ?? { conFactura: false, sinFactura: false },
  ) {
    buscarMedioPagoActivoMock.mockResolvedValue({
      ...medioPagoFixture,
      id: 7,
      nombre,
      conFactura: habilitacion.conFactura,
      sinFactura: habilitacion.sinFactura,
    });
    listarMediosPagoActivosMock.mockResolvedValue(catalogo);
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ requiereFactura })] }),
    );
  }

  it.each(['Débito', 'Crédito', 'Cheque'])(
    'responde 422 al cobrar con %s un presupuesto sin factura',
    async (nombre) => {
      conMedio(nombre, false);

      const respuesta = await registrarPago('1000');

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(respuesta.body.error.message).toContain(nombre);
      expect(crearMock).not.toHaveBeenCalled();
    },
  );

  it.each(['Efectivo', 'Transferencia', 'A la habitación'])(
    'acepta %s con un presupuesto sin factura',
    async (nombre) => {
      conMedio(nombre, false);

      const respuesta = await registrarPago('1000');

      expect(respuesta.status).toBe(201);
    },
  );

  it.each(['Efectivo', 'Transferencia', 'A la habitación', 'Débito', 'Crédito', 'Cheque'])(
    'acepta %s con un presupuesto con factura',
    async (nombre) => {
      conMedio(nombre, true);

      const respuesta = await registrarPago('1000');

      expect(respuesta.status).toBe(201);
    },
  );

  // Los medios de versiones anteriores siguen en la base por los pagos históricos, pero ya no se
  // cobra con ellos ni cuando el presupuesto se factura.
  it('responde 422 con un medio que quedó fuera del catálogo', async () => {
    conMedio('Tarjeta', true);

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(crearMock).not.toHaveBeenCalled();
  });

  // CP-19-02: un medio dado de alta (HU-19) se puede usar en un cobro del caso que habilita.
  it('acepta un medio dado de alta en el caso para el que se habilitó', async () => {
    conMedio('Mercado Pago', false, { conFactura: true, sinFactura: true });

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(201);
  });

  // CP-19-09: y se rechaza en el otro, informando con qué se puede cobrar.
  it('responde 422 con un medio dado de alta solo con factura en un presupuesto sin factura', async () => {
    conMedio('Mercado Pago', false, { conFactura: true, sinFactura: false });

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toBe(
      'No se puede cobrar con Mercado Pago en un evento sin factura: los medios habilitados son Efectivo, Transferencia, A la habitación',
    );
    expect(crearMock).not.toHaveBeenCalled();
  });
});

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

// HU-21: el estado de cuenta. Todo se calcula en cada consulta, nada se guarda.
describe('GET /api/eventos/:id/pagos — estado de cuenta (HU-21)', () => {
  const instanteSena = new Date('2026-10-06T15:00:00.000Z');

  // Un pago con id e instante de registro propios: las marcas de seña y de pago completo se
  // deciden por el orden de registro y por senaRegistradaEn.
  function pagoRegistrado(id: number, monto: string, creadoEn: Date) {
    return { ...pagoFixture(monto), id, creadoEn };
  }

  function despues(fecha: Date, milisegundos: number) {
    return new Date(fecha.getTime() + milisegundos);
  }

  const UN_DIA = 24 * 60 * 60 * 1000;

  function consultarCuenta(cookie = cookieResponsableEventos) {
    return request(app).get('/api/eventos/20/pagos').set('Cookie', [cookie]);
  }

  it('sin pagos el saldo es la base de cobro y la seña no está alcanzada', async () => {
    listarDeEventoMock.mockResolvedValue([]);

    const respuesta = await consultarCuenta();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.pagos).toEqual([]);
    expect(respuesta.body.data.saldo).toMatchObject({
      baseDeCobro: '142200.00',
      pagado: '0.00',
      saldo: '142200.00',
      montoSena: '28440.00',
      senaAlcanzada: false,
    });
  });

  it('la seña es el 20% de la base con IVA cuando el presupuesto requiere factura (RN-01)', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ requiereFactura: true })] }),
    );
    listarDeEventoMock.mockResolvedValue([]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.saldo).toMatchObject({
      baseDeCobro: BASE_CON_FACTURA,
      incluyeIva: true,
      montoSena: SENA_CON_FACTURA,
    });
  });

  it('redondea la seña para arriba al centavo', async () => {
    // 476436 × 1,21 = 576487,56 → 20% = 115297,512 → 115297,52.
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        presupuestos: [
          {
            ...presupuestoFixture({ requiereFactura: true }),
            total: new Prisma.Decimal('476436'),
          },
        ],
      }),
    );
    listarDeEventoMock.mockResolvedValue([]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.saldo.montoSena).toBe('115297.52');
  });

  it('da la seña por alcanzada cuando lo pagado llega al 20%', async () => {
    listarDeEventoMock.mockResolvedValue([pagoRegistrado(1, SENA_SIN_FACTURA, instanteSena)]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.saldo.senaAlcanzada).toBe(true);
  });

  it('un evento reservado mantiene la seña alcanzada aunque después suba el total (RN-09)', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        estado: 'Reservado',
        senaRegistradaEn: instanteSena,
        presupuestos: [
          { ...presupuestoFixture({ estado: 'Confirmado' }), total: new Prisma.Decimal('300000') },
        ],
      }),
    );
    listarDeEventoMock.mockResolvedValue([pagoRegistrado(1, SENA_SIN_FACTURA, instanteSena)]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.saldo).toMatchObject({
      montoSena: '60000.00',
      senaAlcanzada: true,
    });
  });

  it('si el total bajó por debajo de lo pagado, el saldo es negativo: saldo a favor del cliente', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        estado: 'Reservado',
        senaRegistradaEn: instanteSena,
        presupuestos: [presupuestoFixture({ estado: 'Confirmado' })],
      }),
    );
    listarDeEventoMock.mockResolvedValue([
      pagoRegistrado(1, '50000', instanteSena),
      pagoRegistrado(2, '100000', despues(instanteSena, UN_DIA)),
    ]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.saldo.saldo).toBe('-7800.00');
  });

  it('un evento Cobrado queda con saldo cero y marca el pago de la seña y el que completó el total', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        estado: 'Cobrado',
        senaRegistradaEn: instanteSena,
        presupuestos: [presupuestoFixture({ estado: 'Confirmado' })],
      }),
    );
    listarDeEventoMock.mockResolvedValue([
      pagoRegistrado(1, '10000', despues(instanteSena, -UN_DIA)),
      pagoRegistrado(2, '18440', instanteSena),
      pagoRegistrado(3, '113760', despues(instanteSena, 7 * UN_DIA)),
    ]);

    const respuesta = await consultarCuenta();
    const { pagos, saldo } = respuesta.body.data;

    expect(saldo.saldo).toBe('0.00');
    expect(pagos.map((p: { completaSena: boolean }) => p.completaSena)).toEqual([
      false,
      true,
      false,
    ]);
    expect(pagos.map((p: { completaPago: boolean }) => p.completaPago)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('un pago único que completó la seña y el total lleva las dos marcas', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        estado: 'Cobrado',
        senaRegistradaEn: instanteSena,
        presupuestos: [presupuestoFixture({ estado: 'Confirmado' })],
      }),
    );
    listarDeEventoMock.mockResolvedValue([pagoRegistrado(1, TOTAL_SIN_IVA, instanteSena)]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.pagos[0]).toMatchObject({ completaSena: true, completaPago: true });
  });

  it('la seña es el pago registrado más cerca de senaRegistradaEn aunque los relojes difieran', async () => {
    // La base escribió creadoEn unos milisegundos después de que el servidor marcara la seña.
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        estado: 'Reservado',
        senaRegistradaEn: instanteSena,
        presupuestos: [presupuestoFixture({ estado: 'Confirmado' })],
      }),
    );
    listarDeEventoMock.mockResolvedValue([
      pagoRegistrado(1, SENA_SIN_FACTURA, despues(instanteSena, 5)),
      pagoRegistrado(2, '1000', despues(instanteSena, UN_DIA)),
    ]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.pagos[0].completaSena).toBe(true);
    expect(respuesta.body.data.pagos[1].completaSena).toBe(false);
  });

  it('un evento reservado sin senaRegistradaEn marca el pago con el que el acumulado llegó al 20%', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        estado: 'Reservado',
        presupuestos: [presupuestoFixture({ estado: 'Confirmado' })],
      }),
    );
    listarDeEventoMock.mockResolvedValue([
      pagoRegistrado(1, '10000', instanteSena),
      pagoRegistrado(2, '20000', despues(instanteSena, UN_DIA)),
      pagoRegistrado(3, '5000', despues(instanteSena, 2 * UN_DIA)),
    ]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.pagos.map((p: { completaSena: boolean }) => p.completaSena)).toEqual(
      [false, true, false],
    );
  });

  it('un evento en consulta no tiene pago de seña ni de total', async () => {
    listarDeEventoMock.mockResolvedValue([pagoRegistrado(1, '5000', instanteSena)]);

    const respuesta = await consultarCuenta();

    expect(respuesta.body.data.pagos[0]).toMatchObject({
      completaSena: false,
      completaPago: false,
    });
  });

  it('un evento Cancelado conserva sus pagos y la base de su presupuesto dado de baja (RN-06)', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        estado: 'Cancelado',
        presupuestos: [presupuestoFixture({ estado: 'Cancelado' })],
      }),
    );
    listarDeEventoMock.mockResolvedValue([pagoRegistrado(1, '14220', instanteSena)]);

    const respuesta = await consultarCuenta();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.pagos).toHaveLength(1);
    expect(respuesta.body.data.saldo).toMatchObject({
      baseDeCobro: '142200.00',
      pagado: '14220.00',
      saldo: '127980.00',
    });
  });

  it('un Cliente no accede al estado de cuenta', async () => {
    const respuesta = await consultarCuenta(cookieDe('CLIENTE', 'ana@empresa.com'));

    expect(respuesta.status).toBe(403);
    expect(listarDeEventoMock).not.toHaveBeenCalled();
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
    expect(listarTodosLosMediosPagoMock).not.toHaveBeenCalled();
  });

  // HU-20, CP-20-01 y CP-20-03: el listado trae también los dados de baja, con su estado y su
  // habilitación, en el orden alfabético en que los devuelve el repositorio.
  it('con incluirInactivos=true devuelve también los dados de baja, con su habilitación', async () => {
    listarTodosLosMediosPagoMock.mockResolvedValue([
      { ...medioPagoFixture, id: 3, nombre: 'A la habitación' },
      { ...medioPagoFixture, id: 1, nombre: 'Efectivo' },
      {
        ...medioPagoFixture,
        id: 6,
        nombre: 'Tarjeta',
        activo: false,
        conFactura: false,
        sinFactura: false,
      },
    ]);

    const respuesta = await request(app)
      .get('/api/medios-pago?incluirInactivos=true')
      .set('Cookie', [cookieResponsableEventos]);

    expect(respuesta.status).toBe(200);
    expect(listarMediosPagoActivosMock).not.toHaveBeenCalled();
    expect(respuesta.body.data.map((m: { nombre: string }) => m.nombre)).toEqual([
      'A la habitación',
      'Efectivo',
      'Tarjeta',
    ]);
    expect(respuesta.body.data[2]).toMatchObject({
      activo: false,
      conFactura: false,
      sinFactura: false,
    });
  });

  it('un valor de incluirInactivos que no es booleano responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await request(app)
      .get('/api/medios-pago?incluirInactivos=quizas')
      .set('Cookie', [cookieResponsableEventos]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  // CP-20-05
  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const sinSesion = await request(app).get('/api/medios-pago');
    const comoCliente = await request(app)
      .get('/api/medios-pago')
      .set('Cookie', [cookieDe('CLIENTE', 'cliente@mail.test')]);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
  });
});

describe('POST /api/medios-pago (HU-19)', () => {
  const alta = (cuerpo: object, cookie = cookieResponsableEventos) =>
    request(app).post('/api/medios-pago').set('Cookie', [cookie]).send(cuerpo);

  beforeEach(() => {
    buscarMedioPagoPorNombreMock.mockReset();
    crearMedioPagoMock.mockReset();
    buscarMedioPagoPorNombreMock.mockResolvedValue(null);
    crearMedioPagoMock.mockImplementation(async (datos) => ({
      ...medioPagoFixture,
      id: 9,
      ...datos,
    }));
  });

  // CP-19-01
  it('crea el medio activo con su habilitación y el nombre recortado', async () => {
    const respuesta = await alta({ nombre: '  Mercado Pago ', conFactura: true, sinFactura: true });

    expect(respuesta.status).toBe(201);
    expect(crearMedioPagoMock).toHaveBeenCalledWith({
      nombre: 'Mercado Pago',
      conFactura: true,
      sinFactura: true,
    });
    expect(respuesta.body.data).toMatchObject({
      id: 9,
      nombre: 'Mercado Pago',
      activo: true,
      conFactura: true,
      sinFactura: true,
    });
  });

  it('se puede habilitar para un solo caso', async () => {
    const respuesta = await alta({ nombre: 'Vale', sinFactura: true });

    expect(respuesta.status).toBe(201);
    expect(crearMedioPagoMock).toHaveBeenCalledWith({
      nombre: 'Vale',
      conFactura: false,
      sinFactura: true,
    });
  });

  // CP-19-04
  it('sin nombre o con el nombre solo con espacios responde 400 VALIDATION_ERROR', async () => {
    for (const cuerpo of [{ sinFactura: true }, { nombre: '   ', sinFactura: true }]) {
      const respuesta = await alta(cuerpo);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
      expect(respuesta.body.error.details[0].campo).toBe('nombre');
    }
    expect(crearMedioPagoMock).not.toHaveBeenCalled();
  });

  // CP-19-08
  it('sin habilitarlo en ningún caso responde 400 VALIDATION_ERROR', async () => {
    const respuesta = await alta({ nombre: 'Vale' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].campo).toBe('conFactura');
    expect(crearMedioPagoMock).not.toHaveBeenCalled();
  });

  // CP-19-05: el nombre es único sin distinguir mayúsculas.
  it('un nombre que ya existe con otras mayúsculas responde 409 CONFLICT', async () => {
    buscarMedioPagoPorNombreMock.mockResolvedValue({ ...medioPagoFixture, nombre: 'Efectivo' });

    const respuesta = await alta({ nombre: 'efectivo', sinFactura: true });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(buscarMedioPagoPorNombreMock).toHaveBeenCalledWith('efectivo');
    expect(crearMedioPagoMock).not.toHaveBeenCalled();
  });

  // CP-19-07
  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const sinSesion = await request(app)
      .post('/api/medios-pago')
      .send({ nombre: 'Vale', sinFactura: true });
    const comoCliente = await alta(
      { nombre: 'Vale', sinFactura: true },
      cookieDe('CLIENTE', 'cliente@mail.test'),
    );

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(crearMedioPagoMock).not.toHaveBeenCalled();
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
