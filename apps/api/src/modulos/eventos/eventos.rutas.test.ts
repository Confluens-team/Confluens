import type { Rol } from '@confluens/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

vi.mock('./eventos.repositorio.js', () => ({
  buscarDetallado: vi.fn(),
  listarAgenda: vi.fn(),
  buscarPresupuestoEstimado: vi.fn(),
  buscarSolapamiento: vi.fn(),
  agendarConDistribuciones: vi.fn(),
  buscarDistribuciones: vi.fn(),
  guardarObservacionesComanda: vi.fn(),
  cancelar: vi.fn(),
  // No hay transacción real en el test: se ejecuta el callback tal cual, `agendar` ya está
  // mockeada arriba y no usa el `tx` que recibiría de una transacción real.
  crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
}));

const {
  buscarDetallado,
  listarAgenda,
  buscarSolapamiento,
  agendarConDistribuciones,
  buscarDistribuciones,
  guardarObservacionesComanda,
  cancelar,
  crearEnTransaccion,
} = await import('./eventos.repositorio.js');

const buscarDetalladoMock = vi.mocked(buscarDetallado);
const listarAgendaMock = vi.mocked(listarAgenda);
const buscarSolapamientoMock = vi.mocked(buscarSolapamiento);
const agendarConDistribucionesMock = vi.mocked(agendarConDistribuciones);
const buscarDistribucionesMock = vi.mocked(buscarDistribuciones);
const guardarObservacionesComandaMock = vi.mocked(guardarObservacionesComanda);
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

const lineaFixture = {
  id: 1,
  presupuestoId: 30,
  servicioId: null,
  salonId: salonFixture.id,
  descripcion: `Salón ${salonFixture.nombre} (jornada completa)`,
  cantidad: 1,
  precioUnitario: new Prisma.Decimal('142200'),
  subtotal: new Prisma.Decimal('142200'),
  aCotizar: false,
  horaEstimada: null,
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
    fecha: new Date('2026-11-15'),
    inicio: null as Date | null,
    fin: null as Date | null,
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
        distribucionId: null as number | null,
        inicio: null as Date | null,
        fin: null as Date | null,
        estado: 'EnConsulta' as EstadoEventoFixture,
        creadoEn: new Date(),
        salon: salonFixture,
        distribucion: null as typeof distribucionFixture | null,
      },
    ],
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

  // ADR 0011: cada salón viene con la distribución que tiene armada en este evento, no como la
  // fila cruda de EventoSalon. La pantalla de cobro la necesita para precargar cada selector.
  it('devuelve cada salón con su distribución, ya aplanado', async () => {
    const base = eventoFixture();
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({
        salones: [
          {
            ...base.salones[0]!,
            distribucionId: distribucionFixture.id,
            distribucion: distribucionFixture,
          },
        ],
      }),
    );

    const respuesta = await request(app).get('/api/eventos/20').set('Cookie', [cookiePersonal]);

    expect(respuesta.body.data.salones).toEqual([
      expect.objectContaining({
        id: salonFixture.id,
        nombre: salonFixture.nombre,
        distribucion: expect.objectContaining({ id: distribucionFixture.id }),
      }),
    ]);
    expect(respuesta.body.data.salones[0]).not.toHaveProperty('salon');
  });

  it('responde 404 si el evento no existe', async () => {
    buscarDetalladoMock.mockResolvedValue(null);

    const respuesta = await request(app).get('/api/eventos/999').set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/eventos/:id/agendar', () => {
  // Un evento puede ocupar varios salones (ADR 0011): se manda la distribución de cada uno.
  const pucara = { ...salonFixture, id: 9, nombre: 'Pucará', capacidadMaxima: 90 };
  const banquetePucara = {
    ...distribucionFixture,
    id: 12,
    salonId: pucara.id,
    nombre: 'Banquete',
    capacidad: 60,
  };
  const vinculo = (salon: typeof salonFixture) => ({
    eventoId: 20,
    salonId: salon.id,
    distribucionId: null as number | null,
    inicio: null as Date | null,
    fin: null as Date | null,
    estado: 'EnConsulta' as EstadoEventoFixture,
    creadoEn: new Date(),
    salon,
    distribucion: null as typeof distribucionFixture | null,
  });
  const enDosSalones = (datos: Partial<ReturnType<typeof eventoFixtureBase>> = {}) =>
    eventoFixture({ salones: [vinculo(salonFixture), vinculo(pucara)], ...datos });

  const cuerpo = (extra: Record<string, unknown> = {}) => ({
    distribuciones: [{ salonId: salonFixture.id, distribucionId: distribucionFixture.id }],
    inicio: inicioValido,
    fin: finValido,
    ...extra,
  });
  const cuerpoDosSalones = (extra: Record<string, unknown> = {}) =>
    cuerpo({
      distribuciones: [
        { salonId: salonFixture.id, distribucionId: distribucionFixture.id },
        { salonId: pucara.id, distribucionId: banquetePucara.id },
      ],
      ...extra,
    });

  const agendar = (body: Record<string, unknown>) =>
    request(app).post('/api/eventos/20/agendar').set('Cookie', [cookiePersonal]).send(body);

  beforeEach(() => {
    buscarDetalladoMock.mockReset();
    buscarDistribucionesMock.mockReset();
    buscarSolapamientoMock.mockReset();
    agendarConDistribucionesMock.mockReset();
    crearEnTransaccionMock.mockClear();

    buscarDetalladoMock.mockResolvedValue(eventoFixture());
    buscarDistribucionesMock.mockResolvedValue([distribucionFixture, banquetePucara]);
    buscarSolapamientoMock.mockResolvedValue(null);
    agendarConDistribucionesMock.mockResolvedValue(undefined);
  });

  // ADR 0008: una consulta social llega sin salón; no hay contra qué validar la distribución.
  it('responde 422 si el evento todavía no tiene salón, sin escribir nada', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ salones: [] }));

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toBe(
      'Cargá el salón en la consulta antes de agendar el evento',
    );
    expect(agendarConDistribucionesMock).not.toHaveBeenCalled();
  });

  // La aserción central de HU-13: agendar fija el horario y NADA MÁS. El evento sigue EnConsulta y
  // el presupuesto sigue Estimado; la reserva la dispara el pago que cruza el 20% (módulo pagos).
  it('fija distribución y horario sin reservar: el evento sigue EnConsulta y el presupuesto Estimado', async () => {
    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(200);
    expect(crearEnTransaccionMock).toHaveBeenCalledTimes(1);
    const [datosAgenda] = agendarConDistribucionesMock.mock.calls[0]!;
    expect(datosAgenda).toEqual({
      eventoId: 20,
      distribuciones: [{ salonId: salonFixture.id, distribucionId: distribucionFixture.id }],
      inicio: new Date(inicioValido),
      fin: new Date(finValido),
      modalidadSalonRestaurante: false,
    });
    expect(respuesta.body.data.estado).toBe('EnConsulta');
    expect(respuesta.body.data.presupuestos[0].estado).toBe('Estimado');
  });

  // RN-09: un evento ya confirmado se puede reagendar sin perder la reserva.
  it('reagenda un evento Reservado sin cambiarle el estado', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Reservado' }));

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(200);
    expect(agendarConDistribucionesMock).toHaveBeenCalled();
    expect(agendarConDistribucionesMock.mock.calls[0]![0]).not.toHaveProperty('estado');
  });

  it('responde 409 si el evento está Cancelado', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Cancelado' }));

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 404 si la distribución no existe', async () => {
    buscarDistribucionesMock.mockResolvedValue([]);

    const respuesta = await agendar(
      cuerpo({ distribuciones: [{ salonId: salonFixture.id, distribucionId: 999 }] }),
    );

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 404 si la distribución pertenece a otro salón', async () => {
    buscarDistribucionesMock.mockResolvedValue([{ ...distribucionFixture, salonId: 999 }]);

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 422 si cantidadPersonas supera la capacidad y no se confirma (criterio 3)', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ cantidadPersonas: 300 }));

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('agenda igual si cantidadPersonas supera la capacidad y confirmarCapacidadExcedida es true', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ cantidadPersonas: 300 }));

    const respuesta = await agendar(cuerpo({ confirmarCapacidadExcedida: true }));

    expect(respuesta.status).toBe(200);
    expect(crearEnTransaccionMock).toHaveBeenCalledTimes(1);
  });

  it('responde 409 si el salón ya está reservado en ese horario (criterio 2), informando el evento en conflicto', async () => {
    buscarSolapamientoMock.mockResolvedValue(eventoFixture({ id: 55 }));

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(respuesta.body.error.message).toBe(
      `El salón ${salonFixture.nombre} ya está reservado en ese horario por el evento #55`,
    );
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 422 si fin no es posterior a inicio', async () => {
    const respuesta = await agendar(cuerpo({ inicio: finValido, fin: inicioValido }));

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

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
  });

  // --- Varios salones (ADR 0011) ------------------------------------------------

  it('guarda la distribución de cada salón, en el orden de los salones del evento', async () => {
    buscarDetalladoMock.mockResolvedValue(enDosSalones({ cantidadPersonas: 100 }));

    // Llegan en otro orden: se reordenan según los salones del evento.
    const respuesta = await agendar(
      cuerpo({
        distribuciones: [
          { salonId: pucara.id, distribucionId: banquetePucara.id },
          { salonId: salonFixture.id, distribucionId: distribucionFixture.id },
        ],
      }),
    );

    expect(respuesta.status).toBe(200);
    const [datosAgenda] = agendarConDistribucionesMock.mock.calls[0]!;
    expect(datosAgenda.distribuciones).toEqual([
      { salonId: salonFixture.id, distribucionId: distribucionFixture.id },
      { salonId: pucara.id, distribucionId: banquetePucara.id },
    ]);
  });

  it('responde 422 si falta la distribución de alguno de los salones', async () => {
    buscarDetalladoMock.mockResolvedValue(enDosSalones());

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toBe('Falta la distribución de Pucará');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 422 si viene la distribución de un salón que no es del evento', async () => {
    const respuesta = await agendar(cuerpoDosSalones());

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toBe(`El salón ${pucara.id} no es de este evento`);
  });

  // Con varios salones la gente se reparte: lo que cuenta es la capacidad sumada.
  it('no pide confirmar la capacidad si la suma de las distribuciones alcanza', async () => {
    // 280 de Conferencia + 60 de Banquete = 340: entran 300 sin confirmar nada.
    buscarDetalladoMock.mockResolvedValue(enDosSalones({ cantidadPersonas: 300 }));

    const respuesta = await agendar(cuerpoDosSalones());

    expect(respuesta.status).toBe(200);
  });

  it('pide confirmar si la gente supera incluso la capacidad sumada', async () => {
    buscarDetalladoMock.mockResolvedValue(enDosSalones({ cantidadPersonas: 400 }));

    const respuesta = await agendar(cuerpoDosSalones());

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.message).toContain('(340)');
  });

  it('busca solapamientos en todos los salones del evento, no solo en el primero', async () => {
    buscarDetalladoMock.mockResolvedValue(enDosSalones({ cantidadPersonas: 100 }));

    await agendar(cuerpoDosSalones());

    expect(buscarSolapamientoMock.mock.calls[0]![0]).toMatchObject({
      salonIds: [salonFixture.id, pucara.id],
    });
  });

  it('el 409 dice en qué salón choca', async () => {
    buscarDetalladoMock.mockResolvedValue(enDosSalones({ cantidadPersonas: 100 }));
    // El otro evento ocupa solo Pucará: el choque es ahí, no en el primer salón.
    buscarSolapamientoMock.mockResolvedValue(eventoFixture({ id: 77, salones: [vinculo(pucara)] }));

    const respuesta = await agendar(cuerpoDosSalones());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.message).toBe(
      'El salón Pucará ya está reservado en ese horario por el evento #77',
    );
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

// Agenda del personal interno (HU-15). Lo que tiene lógica acá es el permiso por rol, la validación
// de los filtros y el aplanado del presupuesto Confirmado en totalPresupuesto; cómo se traducen los
// filtros a la consulta se prueba en eventos.repositorio.test.ts (mockeado, ADR 0003).
describe('GET /api/eventos', () => {
  const cookieDe = (rol: Rol) =>
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
    tipo: 'Corporativo' as 'Social' | 'Corporativo',
    tipoSocial: null,
    tipoSocialDetalle: null as string | null,
    tipoJornada: null,
    horaInicioEstimada: null as string | null,
    modalidadSalonRestaurante: false,
    observacionesComanda: null,
    creadoEn: new Date('2026-09-29T00:00:00.000Z'),
    actualizadoEn: new Date('2026-09-29T00:00:00.000Z'),
    cliente: { id: 1, nombre: 'Ana Pérez', telefono: '3515551234', correo: 'ana@empresa.com' },
    salones: [{ salon: { id: 5, nombre: 'Paraná' }, distribucion: { id: 2, nombre: 'Banquete' } }],
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
      salones: [{ nombre: 'Paraná' }],
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

  // HU-15 es una historia del Responsable de Eventos: la agenda dejó de ser exclusiva del
  // Administrador del Sistema y la ve todo el personal interno.
  it.each([
    'RESPONSABLE_EVENTOS',
    'RESPONSABLE_FINANZAS',
    'GERENTE_GENERAL',
    'ADMINISTRADOR_SISTEMA',
  ] as const)('el rol %s accede a la agenda', async (rol) => {
    listarAgendaMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .get('/api/eventos')
      .set('Cookie', [cookieDe(rol)]);

    expect(respuesta.status).toBe(200);
  });

  it('con sesión de Cliente responde 403 FORBIDDEN', async () => {
    const respuesta = await request(app)
      .get('/api/eventos')
      .set('Cookie', [cookieDe('CLIENTE')]);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(listarAgendaMock).not.toHaveBeenCalled();
  });

  it('le pasa al repositorio los filtros validados, con las listas ya partidas', async () => {
    listarAgendaMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .get('/api/eventos')
      .query({ desde: '2026-11-01', hasta: '2026-11-30', salonId: '5,7', estado: 'Reservado' })
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(200);
    expect(listarAgendaMock).toHaveBeenCalledWith({
      desde: '2026-11-01',
      hasta: '2026-11-30',
      salonId: [5, 7],
      estado: ['Reservado'],
    });
  });

  it.each([
    ['un estado que no existe', { estado: 'Confirmado' }],
    ['una fecha inválida', { desde: '30-11-2026' }],
    ['un id de salón que no es número', { salonId: 'Parana' }],
    ['hasta anterior a desde', { desde: '2026-11-30', hasta: '2026-11-01' }],
  ])('responde 400 VALIDATION_ERROR con %s', async (_caso, filtros) => {
    const respuesta = await request(app)
      .get('/api/eventos')
      .query(filtros)
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
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
    ['patch', '/api/eventos/20/observaciones-comanda'],
  ] as const)('%s %s sin sesión responde 401', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta);

    expect(respuesta.status).toBe(401);
    expect(buscarDetalladoMock).not.toHaveBeenCalled();
  });

  it.each([
    ['get', '/api/eventos/20'],
    ['post', '/api/eventos/20/agendar'],
    ['post', '/api/eventos/20/cancelar'],
    ['patch', '/api/eventos/20/observaciones-comanda'],
  ] as const)('%s %s con sesión de Cliente responde 403', async (metodo, ruta) => {
    const respuesta = await request(app)[metodo](ruta).set('Cookie', [cookieCliente]);

    expect(respuesta.status).toBe(403);
    expect(buscarDetalladoMock).not.toHaveBeenCalled();
  });
});

// Notas al pie de la comanda de cocina. Es texto libre del personal: no toca ninguna regla de
// negocio, el único control es que el evento exista y no esté cancelado.
describe('PATCH /api/eventos/:id/observaciones-comanda', () => {
  const notas = '2 menús veganos y 1 sin TACC.';

  beforeEach(() => {
    buscarDetalladoMock.mockReset();
    guardarObservacionesComandaMock.mockReset();
  });

  it('guarda las observaciones y devuelve el evento', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture());

    const respuesta = await request(app)
      .patch('/api/eventos/20/observaciones-comanda')
      .set('Cookie', [cookiePersonal])
      .send({ observacionesComanda: notas });

    expect(respuesta.status).toBe(200);
    expect(guardarObservacionesComandaMock).toHaveBeenCalledWith(20, notas);
  });

  it('un texto vacío borra las observaciones', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture());

    const respuesta = await request(app)
      .patch('/api/eventos/20/observaciones-comanda')
      .set('Cookie', [cookiePersonal])
      .send({ observacionesComanda: '' });

    expect(respuesta.status).toBe(200);
    expect(guardarObservacionesComandaMock).toHaveBeenCalledWith(20, '');
  });

  it('responde 404 si el evento no existe', async () => {
    buscarDetalladoMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .patch('/api/eventos/999/observaciones-comanda')
      .set('Cookie', [cookiePersonal])
      .send({ observacionesComanda: notas });

    expect(respuesta.status).toBe(404);
    expect(guardarObservacionesComandaMock).not.toHaveBeenCalled();
  });

  it('responde 409 si el evento está cancelado: no tiene comanda', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Cancelado' }));

    const respuesta = await request(app)
      .patch('/api/eventos/20/observaciones-comanda')
      .set('Cookie', [cookiePersonal])
      .send({ observacionesComanda: notas });

    expect(respuesta.status).toBe(409);
    expect(guardarObservacionesComandaMock).not.toHaveBeenCalled();
  });

  it('responde 400 si el texto supera los 2000 caracteres', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture());

    const respuesta = await request(app)
      .patch('/api/eventos/20/observaciones-comanda')
      .set('Cookie', [cookiePersonal])
      .send({ observacionesComanda: 'x'.repeat(2001) });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(guardarObservacionesComandaMock).not.toHaveBeenCalled();
  });
});
