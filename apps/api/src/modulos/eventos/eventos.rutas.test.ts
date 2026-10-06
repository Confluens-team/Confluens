import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

vi.mock('./eventos.repositorio.js', () => ({
  buscarDetallado: vi.fn(),
  listarAgenda: vi.fn(),
  buscarDistribucion: vi.fn(),
  buscarPresupuestoEstimado: vi.fn(),
  buscarSolapamiento: vi.fn(),
  agendar: vi.fn(),
  cancelar: vi.fn(),
  // No hay transacción real en el test: se ejecuta el callback tal cual, `agendar` ya está
  // mockeada arriba y no usa el `tx` que recibiría de una transacción real.
  crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
}));

const {
  buscarDetallado,
  listarAgenda,
  buscarDistribucion,
  buscarSolapamiento,
  agendar,
  cancelar,
  crearEnTransaccion,
} = await import('./eventos.repositorio.js');

const buscarDetalladoMock = vi.mocked(buscarDetallado);
const listarAgendaMock = vi.mocked(listarAgenda);
const buscarDistribucionMock = vi.mocked(buscarDistribucion);
const buscarSolapamientoMock = vi.mocked(buscarSolapamiento);
const agendarMock = vi.mocked(agendar);
const cancelarMock = vi.mocked(cancelar);
const crearEnTransaccionMock = vi.mocked(crearEnTransaccion);

const app = crearApp();

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
  nombre: 'Marina Gómez',
  apellido: null,
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

const lineaFixture = {
  id: 1,
  presupuestoId: 30,
  servicioId: null,
  descripcion: `Salón ${salonFixture.nombre} (jornada completa)`,
  cantidad: 1,
  precioUnitario: new Prisma.Decimal('142200'),
  subtotal: new Prisma.Decimal('142200'),
};

const presupuestoEstimadoFixture = {
  id: 30,
  eventoId: 20,
  estado: 'Estimado' as const,
  fechaEmision: new Date(),
  venceEn: new Date(),
  total: new Prisma.Decimal('142200'),
  requiereFactura: false,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

function eventoFixture(datos: Partial<ReturnType<typeof eventoFixtureBase>> = {}) {
  return { ...eventoFixtureBase(), ...datos };
}

type EstadoEventoFixture = 'EnConsulta' | 'Reservado' | 'Cobrado' | 'Cancelado';

function eventoFixtureBase() {
  return {
    id: 20,
    clienteId: clienteFixture.id,
    salonId: salonFixture.id,
    distribucionId: null as number | null,
    fecha: new Date('2026-11-15'),
    inicio: null as Date | null,
    fin: null as Date | null,
    cantidadPersonas: 10,
    estado: 'EnConsulta' as EstadoEventoFixture,
    senaVenceEn: null as Date | null,
    senaRegistradaEn: null as Date | null,
    modalidadSalonRestaurante: false,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    cliente: clienteFixture,
    salon: salonFixture,
    distribucion: null as typeof distribucionFixture | null,
    solicitud: null,
    presupuestos: [{ ...presupuestoEstimadoFixture, lineas: [lineaFixture] }],
  };
}

const inicioValido = '2026-11-15T20:00:00.000Z';
const finValido = '2026-11-16T02:00:00.000Z';

// Sesión del personal: desde HU-48 estos endpoints piden sesión (C5 y C6).
const cookiePersonal = `${NOMBRE_COOKIE_SESION}=${firmarToken({
  id: 1,
  email: 're@confluens.test',
  rol: 'RESPONSABLE_EVENTOS',
})}`;

describe('GET /api/eventos/:id', () => {
  beforeEach(() => {
    buscarDetalladoMock.mockReset();
  });

  it('devuelve el detalle del evento', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture());

    const respuesta = await request(app).get('/api/eventos/20').set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.id).toBe(20);
  });

  it('responde 404 si el evento no existe', async () => {
    buscarDetalladoMock.mockResolvedValue(null);

    const respuesta = await request(app).get('/api/eventos/999').set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/eventos/:id/agendar', () => {
  beforeEach(() => {
    buscarDetalladoMock.mockReset();
    buscarDistribucionMock.mockReset();
    buscarSolapamientoMock.mockReset();
    agendarMock.mockReset();
    crearEnTransaccionMock.mockClear();

    buscarDetalladoMock.mockResolvedValue(eventoFixture());
    buscarDistribucionMock.mockResolvedValue(distribucionFixture);
    buscarSolapamientoMock.mockResolvedValue(null);
    agendarMock.mockResolvedValue({
      ...eventoFixtureBase(),
      distribucionId: distribucionFixture.id,
      inicio: new Date(inicioValido),
      fin: new Date(finValido),
    });
  });

  // La aserción central de HU-13: agendar fija el horario y NADA MÁS. El evento sigue EnConsulta y
  // el presupuesto sigue Estimado; la reserva la dispara el pago que cruza el 20% (módulo pagos).
  it('fija distribución y horario sin reservar: el evento sigue EnConsulta y el presupuesto Estimado', async () => {
    const respuesta = await request(app)
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({
        distribucionId: distribucionFixture.id,
        inicio: inicioValido,
        fin: finValido,
      });

    expect(respuesta.status).toBe(200);
    expect(crearEnTransaccionMock).toHaveBeenCalledTimes(1);
    const [datosAgenda] = agendarMock.mock.calls[0]!;
    expect(datosAgenda).toEqual({
      eventoId: 20,
      distribucionId: distribucionFixture.id,
      inicio: new Date(inicioValido),
      fin: new Date(finValido),
      modalidadSalonRestaurante: false,
    });
    expect(respuesta.body.data.estado).toBe('EnConsulta');
    expect(respuesta.body.data.presupuestos[0].estado).toBe('Estimado');
  });

  it('responde 409 si el evento no está EnConsulta', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Reservado' }));

    const respuesta = await request(app)
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({ distribucionId: distribucionFixture.id, inicio: inicioValido, fin: finValido });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 404 si la distribución no existe', async () => {
    buscarDistribucionMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({ distribucionId: 999, inicio: inicioValido, fin: finValido });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 404 si la distribución pertenece a otro salón', async () => {
    buscarDistribucionMock.mockResolvedValue({ ...distribucionFixture, salonId: 999 });

    const respuesta = await request(app)
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({ distribucionId: distribucionFixture.id, inicio: inicioValido, fin: finValido });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 422 si cantidadPersonas supera la capacidad y no se confirma (criterio 3)', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ cantidadPersonas: 300 }));

    const respuesta = await request(app)
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({ distribucionId: distribucionFixture.id, inicio: inicioValido, fin: finValido });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('agenda igual si cantidadPersonas supera la capacidad y confirmarCapacidadExcedida es true', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ cantidadPersonas: 300 }));

    const respuesta = await request(app)
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({
        distribucionId: distribucionFixture.id,
        inicio: inicioValido,
        fin: finValido,
        confirmarCapacidadExcedida: true,
      });

    expect(respuesta.status).toBe(200);
    expect(crearEnTransaccionMock).toHaveBeenCalledTimes(1);
  });

  it('responde 409 si el salón ya está reservado en ese horario (criterio 2), informando el evento en conflicto', async () => {
    buscarSolapamientoMock.mockResolvedValue(eventoFixture({ id: 55 }));

    const respuesta = await request(app)
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({ distribucionId: distribucionFixture.id, inicio: inicioValido, fin: finValido });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(respuesta.body.error.message).toContain('#55');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 422 si fin no es posterior a inicio', async () => {
    const respuesta = await request(app)
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({
        distribucionId: distribucionFixture.id,
        inicio: finValido,
        fin: inicioValido,
      });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 409 si la constraint EXCLUDE de Postgres detecta una carrera de solapamiento', async () => {
    // Forma real verificada empíricamente contra Postgres (Prisma 7.10.0 + @prisma/adapter-pg):
    // code 'P2039' con el SQLSTATE real (23P01 = exclusion_violation) anidado en
    // meta.driverAdapterError.cause.code. Ver el comentario de esViolacionDeSolapamiento.
    crearEnTransaccionMock.mockRejectedValueOnce(
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
      .post('/api/eventos/20/agendar')
      .set('Cookie', [cookiePersonal])
      .send({ distribucionId: distribucionFixture.id, inicio: inicioValido, fin: finValido });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /api/eventos/:id/cancelar', () => {
  beforeEach(() => {
    buscarDetalladoMock.mockReset();
    cancelarMock.mockReset();
    cancelarMock.mockResolvedValue(eventoFixtureBase());
  });

  it('cancela un evento EnConsulta sin restricción de horario (criterio 5)', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'EnConsulta' }));

    const respuesta = await request(app)
      .post('/api/eventos/20/cancelar')
      .set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(200);
    expect(cancelarMock).toHaveBeenCalledWith(20);
  });

  it('cancela un evento Reservado con más de 48 horas de anticipación', async () => {
    const inicio = new Date(Date.now() + 72 * 60 * 60 * 1000);
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Reservado', inicio }));

    const respuesta = await request(app)
      .post('/api/eventos/20/cancelar')
      .set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(200);
    expect(cancelarMock).toHaveBeenCalledWith(20);
  });

  it('responde 422 si faltan menos de 48 horas para el inicio (RN-07)', async () => {
    const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Reservado', inicio }));

    const respuesta = await request(app)
      .post('/api/eventos/20/cancelar')
      .set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(cancelarMock).not.toHaveBeenCalled();
  });

  it('responde 409 si el evento ya está Cobrado o Cancelado', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Cobrado' }));

    const respuesta = await request(app)
      .post('/api/eventos/20/cancelar')
      .set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(cancelarMock).not.toHaveBeenCalled();
  });
});

// Agenda del panel del Administrador del Sistema. Lo que tiene lógica es el permiso por rol y el
// aplanado del presupuesto Confirmado en totalPresupuesto; el filtro por estado es parte de la
// consulta del repositorio (mockeado, ADR 0003).
describe('GET /api/eventos', () => {
  const cookieDe = (rol: 'ADMINISTRADOR_SISTEMA' | 'RESPONSABLE_EVENTOS') =>
    `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 9, email: 'admin@confluens.test', rol })}`;

  const eventoAgenda = {
    id: 3,
    clienteId: 1,
    salonId: 5,
    distribucionId: 2,
    fecha: new Date('2026-11-20T00:00:00.000Z'),
    inicio: new Date('2026-11-20T13:00:00.000Z'),
    fin: new Date('2026-11-20T18:00:00.000Z'),
    cantidadPersonas: 50,
    estado: 'Reservado',
    senaVenceEn: new Date('2026-10-09T00:00:00.000Z'),
    senaRegistradaEn: null,
    modalidadSalonRestaurante: false,
    creadoEn: new Date('2026-09-29T00:00:00.000Z'),
    actualizadoEn: new Date('2026-09-29T00:00:00.000Z'),
    cliente: { id: 1, nombre: 'Ana Pérez', telefono: '3515551234', correo: 'ana@empresa.com' },
    salon: { id: 5, nombre: 'Paraná' },
    distribucion: { id: 2, nombre: 'Banquete' },
  };

  beforeEach(() => {
    listarAgendaMock.mockReset();
  });

  it('con sesión de Administrador del Sistema responde 200 con el total del presupuesto Confirmado', async () => {
    listarAgendaMock.mockResolvedValue([
      { ...eventoAgenda, presupuestos: [{ total: new Prisma.Decimal('1263936.00') }] },
      { ...eventoAgenda, id: 4, estado: 'Cobrado', presupuestos: [] },
    ] as never);

    const respuesta = await request(app)
      .get('/api/eventos')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveLength(2);
    expect(respuesta.body.data[0]).toMatchObject({
      id: 3,
      cliente: { nombre: 'Ana Pérez' },
      salon: { nombre: 'Paraná' },
      totalPresupuesto: '1263936',
    });
    expect(respuesta.body.data[0]).not.toHaveProperty('presupuestos');
    expect(respuesta.body.data[1].totalPresupuesto).toBeNull();
  });

  it('sin cookie de sesión responde 401 UNAUTHENTICATED', async () => {
    const respuesta = await request(app).get('/api/eventos');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    expect(listarAgendaMock).not.toHaveBeenCalled();
  });

  it('con otro rol responde 403 FORBIDDEN', async () => {
    const respuesta = await request(app)
      .get('/api/eventos')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(listarAgendaMock).not.toHaveBeenCalled();
  });
});

// C6 de HU-48: el detalle y las acciones de estado son del panel interno.
describe('eventos: permisos (HU-48)', () => {
  beforeEach(() => buscarDetalladoMock.mockReset());

  const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
    id: 7,
    email: 'ana@empresa.com',
    rol: 'CLIENTE',
  })}`;

  it.each([
    ['get', '/api/eventos/20'],
    ['post', '/api/eventos/20/agendar'],
    ['post', '/api/eventos/20/cancelar'],
  ] as const)('%s %s sin sesión responde 401', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta);

    expect(respuesta.status).toBe(401);
    expect(buscarDetalladoMock).not.toHaveBeenCalled();
  });

  it.each([
    ['get', '/api/eventos/20'],
    ['post', '/api/eventos/20/agendar'],
    ['post', '/api/eventos/20/cancelar'],
  ] as const)('%s %s con sesión de Cliente responde 403', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta).set('Cookie', [cookieCliente]);

    expect(respuesta.status).toBe(403);
    expect(buscarDetalladoMock).not.toHaveBeenCalled();
  });
});
