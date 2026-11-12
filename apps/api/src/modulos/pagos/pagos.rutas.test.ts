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
  buscarPago: vi.fn(),
  anular: vi.fn(),
  buscarMedioPagoActivo: vi.fn(),
  listarMediosPagoActivos: vi.fn(),
  listarTodosLosMediosPago: vi.fn(),
  buscarMedioPagoPorNombre: vi.fn(),
  crearMedioPago: vi.fn(),
  buscarMedioPagoPorId: vi.fn(),
  modificarMedioPago: vi.fn(),
  crear: vi.fn(),
  confirmarPresupuestoYReservar: vi.fn(),
  marcarCobrado: vi.fn(),
  volverAReservado: vi.fn(),
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
  buscarPago,
  anular,
  buscarMedioPagoActivo,
  listarMediosPagoActivos,
  listarTodosLosMediosPago,
  buscarMedioPagoPorNombre,
  crearMedioPago,
  buscarMedioPagoPorId,
  modificarMedioPago,
  crear,
  confirmarPresupuestoYReservar,
  marcarCobrado,
  volverAReservado,
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
const buscarMedioPagoPorIdMock = vi.mocked(buscarMedioPagoPorId);
const modificarMedioPagoMock = vi.mocked(modificarMedioPago);
const crearMock = vi.mocked(crear);
const confirmarPresupuestoYReservarMock = vi.mocked(confirmarPresupuestoYReservar);
const marcarCobradoMock = vi.mocked(marcarCobrado);
const buscarPagoMock = vi.mocked(buscarPago);
const anularMock = vi.mocked(anular);
const volverAReservadoMock = vi.mocked(volverAReservado);
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
  activo: true,
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
  modalidad: 'Normal' as const,
  precioBase: null,
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
    ocultoEn: null,
    avisoRecepcionEn: null,
    envioFormalEn: null,
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
    horaFinEstimada: null as string | null,
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
    anuladoEn: null as Date | null,
    anuladoPorId: null as number | null,
    anuladoPor: null as { id: number; email: string } | null,
  };
}

function cuerpoPago(monto: string) {
  return { fecha: '2026-10-06', monto, medioPagoId: medioPagoFixture.id };
}

const cookieDe = (rol: string, email: string) =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email, rol: rol as 'RESPONSABLE_EVENTOS' })}`;

const cookieResponsableEventos = cookieDe('RESPONSABLE_EVENTOS', 're@confluens.test');
// HU-56: el RE no administra medios de pago; los administra el RF (y el GG y el ADM).
const cookieAdministraMedios = cookieDe('RESPONSABLE_FINANZAS', 'rf@confluens.test');

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
  buscarPagoMock.mockReset();
  anularMock.mockReset();
  volverAReservadoMock.mockReset();

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

  // Borde de la seña: un centavo menos no reserva y un centavo más sí (el 20% exacto ya está arriba).
  it.each([
    ['sin factura, un centavo menos que la seña', false, '28439.99', false],
    ['sin factura, un centavo más que la seña', false, '28440.01', true],
    ['con factura, un centavo menos que la seña', true, '34412.39', false],
    ['con factura, un centavo más que la seña', true, '34412.41', true],
  ])('%s', async (_caso, requiereFactura, monto, reserva) => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ requiereFactura })] }),
    );

    const respuesta = await registrarPago(monto);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.reservoElSalon).toBe(reserva);
    expect(respuesta.body.data.estadoEvento).toBe(reserva ? 'Reservado' : 'EnConsulta');
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

  // HU-55 (RN-06): se cobra aunque el presupuesto esté vencido, sin recalcularlo.
  it('acepta un pago con el presupuesto Expirado, sin recalcularlo', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ estado: 'Expirado' })] }),
    );

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(201);
    expect(crearMock).toHaveBeenCalled();
    expect(respuesta.body.data.estadoEvento).toBe('EnConsulta');
    expect(confirmarPresupuestoYReservarMock).not.toHaveBeenCalled();
  });

  // HU-55: la seña de un Expirado lo confirma (Expirado → Confirmado) y reserva el salón, sobre la
  // base del presupuesto vencido, sin precios nuevos.
  it('la seña de un presupuesto Expirado lo confirma y reserva el salón', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ estado: 'Expirado' })] }),
    );

    const respuesta = await registrarPago(SENA_SIN_FACTURA);

    expect(respuesta.status).toBe(201);
    expect(confirmarPresupuestoYReservarMock).toHaveBeenCalledWith(
      { eventoId: 20, presupuestoId: 30 },
      undefined,
    );
    expect(respuesta.body.data.estadoEvento).toBe('Reservado');
    expect(respuesta.body.data.reservoElSalon).toBe(true);
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
    // Tope de 500 millones por pago (PO, 08/11/2026): un centavo más se rechaza.
    [
      'monto sobre el tope de 500 millones',
      { fecha: '2026-10-06', monto: '500000000.01', medioPagoId: 1 },
    ],
    ['monto enorme', { fecha: '2026-10-06', monto: '9999999999.99', medioPagoId: 1 }],
    ['monto con tres decimales', { fecha: '2026-10-06', monto: '1000.123', medioPagoId: 1 }],
    ['monto con coma decimal', { fecha: '2026-10-06', monto: '1000,50', medioPagoId: 1 }],
    ['monto en notación científica', { fecha: '2026-10-06', monto: '1e5', medioPagoId: 1 }],
    ['monto vacío', { fecha: '2026-10-06', monto: '', medioPagoId: 1 }],
    ['monto numérico en lugar de texto', { fecha: '2026-10-06', monto: 1000, medioPagoId: 1 }],
    ['monto nulo', { fecha: '2026-10-06', monto: null, medioPagoId: 1 }],
    ['fecha imposible', { fecha: '2026-02-30', monto: '1000', medioPagoId: 1 }],
    ['medio de pago decimal', { fecha: '2026-10-06', monto: '1000', medioPagoId: 1.5 }],
    ['medio de pago en cero', { fecha: '2026-10-06', monto: '1000', medioPagoId: 0 }],
    ['observación vacía', { fecha: '2026-10-06', monto: '1000', medioPagoId: 1, observacion: '' }],
    [
      'observación de solo espacios',
      { fecha: '2026-10-06', monto: '1000', medioPagoId: 1, observacion: '    ' },
    ],
    [
      'observación de más de 500 caracteres',
      { fecha: '2026-10-06', monto: '1000', medioPagoId: 1, observacion: 'a'.repeat(501) },
    ],
  ])('responde 400 con %s', async (_caso, cuerpo) => {
    const respuesta = await request(app)
      .post('/api/eventos/20/pagos')
      .set('Cookie', [cookieResponsableEventos])
      .send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearMock).not.toHaveBeenCalled();
  });

  // El PO decidió que la fecha del pago no tiene límite (07/11/2026): se puede cargar uno de
  // cualquier día, anterior o posterior a hoy.
  it.each(['1990-01-01', '2030-01-01'])(
    'acepta un pago con fecha %s: no hay tope',
    async (fecha) => {
      const respuesta = await request(app)
        .post('/api/eventos/20/pagos')
        .set('Cookie', [cookieResponsableEventos])
        .send({ fecha, monto: '1000', medioPagoId: 1 });

      expect(respuesta.status).toBe(201);
      expect(crearMock).toHaveBeenCalledTimes(1);
    },
  );

  // El middleware rechazar-html corta el marcado en la entrada (auditoría de seguridad, H3).
  it.each([
    '<script>alert("x")</script>',
    '<b>seña</b>',
    'pagó &amp; firmó',
    '<img src=x onerror=1>',
  ])('rechaza una observación con HTML (%s) y dice qué campo corregir', async (observacion) => {
    const respuesta = await request(app)
      .post('/api/eventos/20/pagos')
      .set('Cookie', [cookieResponsableEventos])
      .send({ fecha: '2026-10-06', monto: '1000', medioPagoId: 1, observacion });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details).toEqual([
      { campo: 'observacion', mensaje: 'No se admite HTML en este campo' },
    ]);
    expect(crearMock).not.toHaveBeenCalled();
  });

  it('guarda una observación con tildes, emojis y símbolos que no son marcado', async () => {
    const observacion = 'Seña 20% — pagó "en mano" 💰 (saldo < 50%)';

    const respuesta = await request(app)
      .post('/api/eventos/20/pagos')
      .set('Cookie', [cookieResponsableEventos])
      .send({ fecha: '2026-10-06', monto: '1000', medioPagoId: 1, observacion });

    expect(respuesta.status).toBe(201);
    expect(crearMock.mock.calls[0]?.[0]).toMatchObject({ observacion });
  });

  it('acepta una observación de exactamente 500 caracteres', async () => {
    const respuesta = await request(app)
      .post('/api/eventos/20/pagos')
      .set('Cookie', [cookieResponsableEventos])
      .send({ fecha: '2026-10-06', monto: '1000', medioPagoId: 1, observacion: 'a'.repeat(500) });

    expect(respuesta.status).toBe(201);
  });
});

// HU-13 C6: las consultas que pisan la franja no se cancelan (dominio.md:30, Cancelado es siempre
// manual), se informan para que el Responsable de Eventos las gestione.
// RN-14 desde HU-53 (reunión con el cliente del 05/11/2026): todos los medios activos se pueden usar
// en todos los cobros, con factura o sin ella. Las marcas viejas de cada medio ya no deciden nada.
describe('POST /api/eventos/:id/pagos — medios de pago (RN-14, HU-53)', () => {
  function conMedio(
    nombre: string,
    requiereFactura: boolean,
    marcas = { conFactura: true, sinFactura: false },
  ) {
    buscarMedioPagoActivoMock.mockResolvedValue({ ...medioPagoFixture, id: 7, nombre, ...marcas });
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ presupuestos: [presupuestoFixture({ requiereFactura })] }),
    );
  }

  it.each(['Efectivo', 'Transferencia', 'A la habitación', 'Débito', 'Crédito', 'Cheque'])(
    'acepta %s con un presupuesto con factura y con uno anterior sin factura',
    async (nombre) => {
      conMedio(nombre, true);
      const conFactura = await registrarPago('1000');
      conMedio(nombre, false);
      const sinFactura = await registrarPago('1000');

      expect(conFactura.status).toBe(201);
      expect(sinFactura.status).toBe(201);
    },
  );

  // Antes de HU-53 un medio dado de alta solo con factura se rechazaba en un cobro sin factura
  // (CP-19-09). Ahora vale igual.
  it('acepta un medio dado de alta solo con factura en un presupuesto anterior sin factura', async () => {
    conMedio('Mercado Pago', false, { conFactura: true, sinFactura: false });

    const respuesta = await registrarPago('1000');

    expect(respuesta.status).toBe(201);
    expect(crearMock).toHaveBeenCalled();
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
  const alta = (cuerpo: object, cookie = cookieAdministraMedios) =>
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

  // HU-56: el RE no administra medios de pago; el RF, el GG y el ADM sí.
  it.each([
    ['RESPONSABLE_FINANZAS', 201],
    ['GERENTE_GENERAL', 201],
    ['ADMINISTRADOR_SISTEMA', 201],
    ['RESPONSABLE_EVENTOS', 403],
    ['CLIENTE', 403],
  ] as const)('con el rol %s responde %i', async (rol, status) => {
    const respuesta = await alta({ nombre: 'Vale' }, cookieDe(rol, 'persona@confluens.test'));

    expect(respuesta.status).toBe(status);
    if (status === 403) {
      expect(respuesta.body.error.code).toBe('FORBIDDEN');
      expect(crearMedioPagoMock).not.toHaveBeenCalled();
    }
  });

  // CP-19-01. Desde HU-53 se carga solo el nombre: el medio vale en todos los cobros.
  it('crea el medio activo con el nombre recortado', async () => {
    const respuesta = await alta({ nombre: '  Mercado Pago ' });

    expect(respuesta.status).toBe(201);
    expect(crearMedioPagoMock).toHaveBeenCalledWith({ nombre: 'Mercado Pago' });
    expect(respuesta.body.data).toMatchObject({ id: 9, nombre: 'Mercado Pago', activo: true });
  });

  it('ignora las marcas de factura que todavía mande un cliente viejo (HU-53)', async () => {
    const respuesta = await alta({ nombre: 'Vale', sinFactura: true });

    expect(respuesta.status).toBe(201);
    expect(crearMedioPagoMock).toHaveBeenCalledWith({ nombre: 'Vale' });
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

  // CP-19-05: el nombre es único sin distinguir mayúsculas.
  it('un nombre que ya existe con otras mayúsculas responde 409 CONFLICT', async () => {
    buscarMedioPagoPorNombreMock.mockResolvedValue({ ...medioPagoFixture, nombre: 'Efectivo' });

    const respuesta = await alta({ nombre: 'efectivo', sinFactura: true });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(buscarMedioPagoPorNombreMock).toHaveBeenCalledWith('efectivo');
    expect(crearMedioPagoMock).not.toHaveBeenCalled();
  });

  it('dos altas simultáneas con el mismo nombre: el índice único responde 409, no 500', async () => {
    buscarMedioPagoPorNombreMock.mockResolvedValue(null);
    crearMedioPagoMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const respuesta = await alta({ nombre: 'Vale' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(respuesta.body.error.message).toContain('Vale');
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

// HU-33 del Sprint 4 («Modificar medio de pago»). Desde HU-53 solo se modifica el nombre.
describe('PATCH /api/medios-pago/:id (HU-33)', () => {
  const modificar = (cuerpo: object, cookie = cookieAdministraMedios, id = 1) =>
    request(app).patch(`/api/medios-pago/${id}`).set('Cookie', [cookie]).send(cuerpo);

  beforeEach(() => {
    buscarMedioPagoPorIdMock.mockReset();
    buscarMedioPagoPorNombreMock.mockReset();
    modificarMedioPagoMock.mockReset();
    buscarMedioPagoPorIdMock.mockResolvedValue(medioPagoFixture);
    buscarMedioPagoPorNombreMock.mockResolvedValue(null);
    modificarMedioPagoMock.mockImplementation(async (id, datos) => ({
      ...medioPagoFixture,
      id,
      ...datos,
    }));
  });

  it.each([
    ['RESPONSABLE_FINANZAS', 200],
    ['GERENTE_GENERAL', 200],
    ['ADMINISTRADOR_SISTEMA', 200],
    ['RESPONSABLE_EVENTOS', 403],
    ['CLIENTE', 403],
  ] as const)('HU-56: con el rol %s responde %i', async (rol, status) => {
    const respuesta = await modificar(
      { nombre: 'Contado' },
      cookieDe(rol, 'persona@confluens.test'),
    );

    expect(respuesta.status).toBe(status);
    if (status === 403) expect(modificarMedioPagoMock).not.toHaveBeenCalled();
  });

  it('cambia el nombre, recortado', async () => {
    const respuesta = await modificar({ nombre: '  Contado ' });

    expect(respuesta.status).toBe(200);
    expect(modificarMedioPagoMock).toHaveBeenCalledWith(1, { nombre: 'Contado' });
    expect(respuesta.body.data.nombre).toBe('Contado');
  });

  it('cambiarle solo las mayúsculas a su propio nombre no choca', async () => {
    buscarMedioPagoPorNombreMock.mockResolvedValue(medioPagoFixture);

    const respuesta = await modificar({ nombre: 'EFECTIVO', conFactura: true, sinFactura: true });

    expect(respuesta.status).toBe(200);
  });

  it('el nombre de otro medio, con otras mayúsculas, responde 409 CONFLICT', async () => {
    buscarMedioPagoPorNombreMock.mockResolvedValue({
      ...medioPagoFixture,
      id: 2,
      nombre: 'Transferencia',
    });

    const respuesta = await modificar({
      nombre: 'transferencia',
      conFactura: true,
      sinFactura: true,
    });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(modificarMedioPagoMock).not.toHaveBeenCalled();
  });

  it('sin nombre o con el nombre solo con espacios responde 400 VALIDATION_ERROR', async () => {
    for (const cuerpo of [{ nombre: '  ' }, {}]) {
      const respuesta = await modificar(cuerpo);
      expect(respuesta.status).toBe(400);
    }
    expect(modificarMedioPagoMock).not.toHaveBeenCalled();
  });

  it.each([
    ['nulo', { nombre: null }],
    ['numérico', { nombre: 123 }],
    ['una lista', { nombre: ['Efectivo'] }],
    ['con HTML', { nombre: '<b>Efectivo</b>' }],
    ['con una entidad HTML', { nombre: 'Cheque &amp; vale' }],
  ])('un nombre %s responde 400 y no escribe', async (_caso, cuerpo) => {
    const respuesta = await modificar(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(modificarMedioPagoMock).not.toHaveBeenCalled();
  });

  it('acepta nombres con tildes, ñ, números y símbolos que no son marcado', async () => {
    const nombre = 'Cheque a 30 días (Ñandú) — 3% rec.';

    const respuesta = await modificar({ nombre });

    expect(respuesta.status).toBe(200);
    expect(modificarMedioPagoMock).toHaveBeenCalledWith(1, { nombre });
  });

  it('busca el nombre ya recortado, para que los espacios no esquiven el 409', async () => {
    buscarMedioPagoPorNombreMock.mockResolvedValue({
      ...medioPagoFixture,
      id: 2,
      nombre: 'Transferencia',
    });

    const respuesta = await modificar({ nombre: '  transferencia  ' });

    expect(respuesta.status).toBe(409);
    expect(buscarMedioPagoPorNombreMock).toHaveBeenCalledWith('transferencia');
  });

  it('desde HU-53 el PATCH solo guarda el nombre: ignora la habilitación y el estado del body', async () => {
    await modificar({
      nombre: 'Contado',
      conFactura: false,
      sinFactura: false,
      activo: false,
      id: 99,
    });

    expect(modificarMedioPagoMock).toHaveBeenCalledWith(1, { nombre: 'Contado' });
  });

  it('con un id que no es entero positivo responde 400 sin consultar', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const respuesta = await modificar({ nombre: 'Contado' }, cookieAdministraMedios, id as never);
      expect(respuesta.status, id).toBe(400);
    }
    expect(buscarMedioPagoPorIdMock).not.toHaveBeenCalled();
  });

  // Igual que en servicios: dos renombres simultáneos al mismo nombre pasan el chequeo previo y el
  // segundo choca con el índice único de la base. Tiene que ser un 409, no un 500.
  it('dos renombres simultáneos al mismo nombre: el índice único responde 409, no 500', async () => {
    modificarMedioPagoMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const respuesta = await modificar({ nombre: 'Contado' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(respuesta.body.error.message).toContain('Contado');
  });

  it('con un medio inexistente responde 404 NOT_FOUND', async () => {
    buscarMedioPagoPorIdMock.mockResolvedValue(null);

    const respuesta = await modificar(
      { nombre: 'Efectivo', conFactura: true, sinFactura: true },
      cookieAdministraMedios,
      99,
    );

    expect(respuesta.status).toBe(404);
    expect(modificarMedioPagoMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 y con sesión de Cliente 403', async () => {
    const cuerpo = { nombre: 'Efectivo', conFactura: true, sinFactura: true };

    const sinSesion = await request(app).patch('/api/medios-pago/1').send(cuerpo);
    const comoCliente = await modificar(cuerpo, cookieDe('CLIENTE', 'cliente@mail.test'));

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(modificarMedioPagoMock).not.toHaveBeenCalled();
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

// HU-35 del Sprint 4: anular un pago sin borrarlo. Queda en la cuenta con la fecha y el usuario que
// lo anuló y deja de sumar; el estado del evento se recalcula en la misma transacción.
describe('POST /api/eventos/:id/pagos/:pagoId/anular (HU-35)', () => {
  const ANULADO_EN = new Date('2026-11-06T18:00:00.000Z');
  const cookieFinanzas = cookieDe('RESPONSABLE_FINANZAS', 'rf@confluens.test');

  function eventoReservado(estado: 'Reservado' | 'Cobrado' = 'Reservado') {
    return eventoFixture({
      estado,
      senaRegistradaEn: new Date('2026-10-06T15:00:00.000Z'),
      presupuestos: [presupuestoFixture({ estado: 'Confirmado' })],
    });
  }

  function anularPago(cookie = cookieFinanzas, ruta = '/api/eventos/20/pagos/100/anular') {
    return request(app).post(ruta).set('Cookie', [cookie]);
  }

  beforeEach(() => {
    buscarDetalladoMock.mockResolvedValue(eventoReservado());
    // Primero el pago vigente (el chequeo previo) y después el ya anulado (la respuesta).
    buscarPagoMock.mockResolvedValueOnce(pagoFixture('10000')).mockResolvedValueOnce({
      ...pagoFixture('10000'),
      anuladoEn: ANULADO_EN,
      anuladoPorId: 1,
      anuladoPor: { id: 1, email: 'rf@confluens.test' },
    });
    anularMock.mockResolvedValue(1);
    volverAReservadoMock.mockImplementation(async () => eventoFixture({ estado: 'Reservado' }));
  });

  it('marca el pago como anulado con el usuario de la sesión y lo devuelve sin borrarlo', async () => {
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal('30000'));

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(200);
    expect(anularMock).toHaveBeenCalledWith({ pagoId: 100, usuarioId: 1 }, undefined);
    expect(respuesta.body.data.pago).toMatchObject({
      id: 100,
      anuladoEn: ANULADO_EN.toISOString(),
      anuladoPor: { id: 1, email: 'rf@confluens.test' },
    });
    expect(respuesta.body.data.saldo.pagado).toBe('30000.00');
    expect(respuesta.body.data.saldo.cubreSena).toBe(true);
    expect(respuesta.body.data.estadoEvento).toBe('Reservado');
  });

  // Borde de la seña sin factura (28440): el 20% exacto la cubre y un centavo menos no.
  it.each([
    ['28440', true],
    ['28439.99', false],
  ])('si lo pagado queda en %s, cubreSena es %s', async (pagado, cubreSena) => {
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal(pagado));

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.saldo.cubreSena).toBe(cubreSena);
    expect(respuesta.body.data.estadoEvento).toBe('Reservado');
  });

  // Borde del total: un Cobrado al que le falta un centavo vuelve a Reservado.
  it('un Cobrado que queda un centavo por debajo del total vuelve a Reservado', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoReservado('Cobrado'));
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal('142199.99'));

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(200);
    expect(volverAReservadoMock).toHaveBeenCalledWith(20, undefined);
    expect(respuesta.body.data.saldo.saldo).toBe('0.01');
  });

  it('el usuario que anula sale de la sesión, aunque el body mande otro', async () => {
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal('30000'));

    const respuesta = await anularPago().send({ usuarioId: 99, anuladoPorId: 99 });

    expect(respuesta.status).toBe(200);
    expect(anularMock).toHaveBeenCalledWith({ pagoId: 100, usuarioId: 1 }, undefined);
  });

  it.each(['0', '-1', '1.5'])('un id de pago %s responde 400', async (id) => {
    const respuesta = await anularPago(cookieFinanzas, `/api/eventos/20/pagos/${id}/anular`);

    expect(respuesta.status).toBe(400);
    expect(anularMock).not.toHaveBeenCalled();
  });

  it('un Reservado que queda por debajo de la seña sigue Reservado y la cuenta lo avisa', async () => {
    // La seña sin factura es 28440: lo que queda no la cubre.
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal('20000'));

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.estadoEvento).toBe('Reservado');
    expect(respuesta.body.data.saldo.cubreSena).toBe(false);
    // La seña ya se registró: no se vuelve a pedir ni el evento vuelve a EnConsulta.
    expect(respuesta.body.data.saldo.senaAlcanzada).toBe(true);
    expect(volverAReservadoMock).not.toHaveBeenCalled();
  });

  it('un Cobrado que queda por debajo del total vuelve a Reservado', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoReservado('Cobrado'));
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal('132200'));

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(200);
    expect(volverAReservadoMock).toHaveBeenCalledWith(20, undefined);
    expect(respuesta.body.data.estadoEvento).toBe('Reservado');
    expect(respuesta.body.data.saldo.saldo).toBe('10000.00');
  });

  it('un Cobrado que sigue cubriendo el total queda Cobrado', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoReservado('Cobrado'));
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal(TOTAL_SIN_IVA));

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.estadoEvento).toBe('Cobrado');
    expect(volverAReservadoMock).not.toHaveBeenCalled();
  });

  it('un evento EnConsulta sigue EnConsulta', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture());
    sumarPagosMock.mockResolvedValue(null);

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.estadoEvento).toBe('EnConsulta');
    expect(respuesta.body.data.saldo.pagado).toBe('0.00');
  });

  it('un pago ya anulado no se anula de nuevo: 409 CONFLICT', async () => {
    buscarPagoMock.mockReset().mockResolvedValue({
      ...pagoFixture('10000'),
      anuladoEn: ANULADO_EN,
      anuladoPorId: 2,
      anuladoPor: { id: 2, email: 'gg@confluens.test' },
    });

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(anularMock).not.toHaveBeenCalled();
  });

  it('dos anulaciones simultáneas: la que no encuentra el pago vigente responde 409', async () => {
    anularMock.mockResolvedValue(0);

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
  });

  it('un pago que no es de ese evento responde 404', async () => {
    buscarPagoMock.mockReset().mockResolvedValue({ ...pagoFixture('10000'), eventoId: 21 });

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(404);
    expect(anularMock).not.toHaveBeenCalled();
  });

  it('un pago que no existe responde 404', async () => {
    buscarPagoMock.mockReset().mockResolvedValue(null);

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(404);
  });

  it('un evento que no existe responde 404', async () => {
    buscarDetalladoMock.mockResolvedValue(null);

    const respuesta = await anularPago(cookieFinanzas, '/api/eventos/999/pagos/100/anular');

    expect(respuesta.status).toBe(404);
  });

  it('en un evento Cancelado responde 409: su cuenta queda como estaba', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Cancelado' }));

    const respuesta = await anularPago();

    expect(respuesta.status).toBe(409);
    expect(anularMock).not.toHaveBeenCalled();
  });

  it('un id de pago inválido responde 400', async () => {
    const respuesta = await anularPago(cookieFinanzas, '/api/eventos/20/pagos/abc/anular');

    expect(respuesta.status).toBe(400);
  });

  it.each([
    ['RESPONSABLE_EVENTOS', 're@confluens.test'],
    ['GERENTE_GENERAL', 'gg@confluens.test'],
    ['ADMINISTRADOR_SISTEMA', 'admin@confluens.test'],
  ])('%s también anula: cualquier rol del personal (PO, 06/11/2026)', async (rol, email) => {
    sumarPagosMock.mockResolvedValue(new Prisma.Decimal('30000'));

    const respuesta = await anularPago(cookieDe(rol, email));

    expect(respuesta.status).toBe(200);
  });

  it('con sesión de Cliente responde 403 y sin sesión 401, sin anular nada', async () => {
    const comoCliente = await anularPago(cookieDe('CLIENTE', 'cliente@example.com'));
    const sinSesion = await request(app).post('/api/eventos/20/pagos/100/anular');

    expect(comoCliente.status).toBe(403);
    expect(sinSesion.status).toBe(401);
    expect(anularMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/eventos/:id/pagos con pagos anulados (HU-35)', () => {
  const instanteSena = new Date('2026-10-06T15:00:00.000Z');
  const anulado = {
    anuladoEn: new Date('2026-11-06T18:00:00.000Z'),
    anuladoPorId: 1,
    anuladoPor: { id: 1, email: 'rf@confluens.test' },
  };

  function pagoRegistrado(id: number, monto: string, creadoEn: Date) {
    return { ...pagoFixture(monto), id, creadoEn };
  }

  function consultarCuenta() {
    return request(app).get('/api/eventos/20/pagos').set('Cookie', [cookieResponsableEventos]);
  }

  it('el pago anulado sigue en la cuenta, marcado, pero no suma a lo pagado ni al saldo', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ estado: 'Reservado', senaRegistradaEn: instanteSena }),
    );
    listarDeEventoMock.mockResolvedValue([
      pagoRegistrado(1, '30000', instanteSena),
      { ...pagoRegistrado(2, '10000', new Date('2026-10-10T15:00:00.000Z')), ...anulado },
    ]);

    const respuesta = await consultarCuenta();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.pagos).toHaveLength(2);
    expect(respuesta.body.data.pagos[1].anuladoPor.email).toBe('rf@confluens.test');
    expect(respuesta.body.data.saldo.pagado).toBe('30000.00');
    expect(respuesta.body.data.saldo.saldo).toBe('112200.00');
    expect(respuesta.body.data.saldo.cubreSena).toBe(true);
  });

  it('si se anuló el pago de la seña, ningún pago queda marcado como el de la seña', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ estado: 'Reservado', senaRegistradaEn: instanteSena }),
    );
    listarDeEventoMock.mockResolvedValue([
      { ...pagoRegistrado(1, '30000', instanteSena), ...anulado },
      pagoRegistrado(2, '5000', new Date('2026-10-07T15:00:00.000Z')),
    ]);

    const respuesta = await consultarCuenta();

    const marcas = respuesta.body.data.pagos.map((p: { completaSena: boolean }) => p.completaSena);
    expect(marcas).toEqual([false, false]);
    expect(respuesta.body.data.saldo.senaAlcanzada).toBe(true);
    expect(respuesta.body.data.saldo.cubreSena).toBe(false);
  });

  it('en un Cobrado, el pago que completó el total es el último vigente, no uno anulado', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ estado: 'Cobrado', senaRegistradaEn: instanteSena }),
    );
    listarDeEventoMock.mockResolvedValue([
      pagoRegistrado(1, '30000', instanteSena),
      pagoRegistrado(2, '112200', new Date('2026-10-10T15:00:00.000Z')),
      { ...pagoRegistrado(3, '100', new Date('2026-10-11T15:00:00.000Z')), ...anulado },
    ]);

    const respuesta = await consultarCuenta();

    const marcas = respuesta.body.data.pagos.map((p: { completaPago: boolean }) => p.completaPago);
    expect(marcas).toEqual([false, true, false]);
    expect(respuesta.body.data.saldo.saldo).toBe('0.00');
  });
});
