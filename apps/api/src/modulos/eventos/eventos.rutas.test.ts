import type { Rol } from '@confluens/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  activo: true,
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
  modalidad: 'Normal' as const,
  precioBase: null,
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
  ocultoEn: null,
  avisoRecepcionEn: null,
  envioFormalEn: null,
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

const cookiePersonalNueva = () =>
  `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email: 're@confluens.test', rol: 'RESPONSABLE_EVENTOS' })}`;

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

  // HU-25 del Sprint 4: una distribución dada de baja no se elige de nuevo, pero la baja no afecta al
  // evento que ya la tenía (PO, 06/11/2026).
  describe('con una distribución dada de baja (HU-25)', () => {
    const dadaDeBaja = { ...distribucionFixture, activo: false };

    it('responde 422 si el evento todavía no la tenía, sin escribir nada', async () => {
      buscarDistribucionesMock.mockResolvedValue([dadaDeBaja]);

      const respuesta = await agendar(cuerpo());

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(respuesta.body.error.message).toBe('La distribución "Conferencia" está dada de baja');
      expect(agendarConDistribucionesMock).not.toHaveBeenCalled();
    });

    it('el evento que ya la tenía en ese salón se reagenda con ella', async () => {
      buscarDistribucionesMock.mockResolvedValue([dadaDeBaja]);
      const base = eventoFixture({ estado: 'Reservado' });
      buscarDetalladoMock.mockResolvedValue({
        ...base,
        salones: [{ ...base.salones[0]!, distribucionId: dadaDeBaja.id, distribucion: dadaDeBaja }],
      });

      const respuesta = await agendar(cuerpo());

      expect(respuesta.status).toBe(200);
      expect(agendarConDistribucionesMock).toHaveBeenCalled();
    });
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

  it('responde 422 si fin es exactamente igual a inicio: un evento de cero minutos no existe', async () => {
    const respuesta = await agendar(cuerpo({ inicio: inicioValido, fin: inicioValido }));

    expect(respuesta.status).toBe(422);
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('acepta un evento de un minuto: es el mínimo que cumple fin > inicio', async () => {
    const respuesta = await agendar(
      cuerpo({ inicio: '2026-11-15T20:00:00.000Z', fin: '2026-11-15T20:01:00.000Z' }),
    );

    expect(respuesta.status).toBe(200);
  });

  // El borde exacto de la capacidad: la gente que entra justo no pide confirmación, una más sí.
  it('con tantas personas como la capacidad de la distribución agenda sin pedir confirmar', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ cantidadPersonas: distribucionFixture.capacidad }),
    );

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(200);
  });

  it('con una persona más que la capacidad pide confirmar el exceso', async () => {
    buscarDetalladoMock.mockResolvedValue(
      eventoFixture({ cantidadPersonas: distribucionFixture.capacidad + 1 }),
    );

    const respuesta = await agendar(cuerpo());

    expect(respuesta.status).toBe(422);
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('un salón repetido en distribuciones responde 400: no puede tener dos', async () => {
    const respuesta = await agendar(
      cuerpo({
        distribuciones: [
          { salonId: salonFixture.id, distribucionId: distribucionFixture.id },
          { salonId: salonFixture.id, distribucionId: banquetePucara.id },
        ],
      }),
    );

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it.each([
    ['sin distribuciones', { distribuciones: [] }],
    ['con distribuciones nulas', { distribuciones: null }],
    [
      'con el id de la distribución en cero',
      { distribuciones: [{ salonId: 5, distribucionId: 0 }] },
    ],
    [
      'con el id de la distribución decimal',
      { distribuciones: [{ salonId: 5, distribucionId: 1.5 }] },
    ],
    [
      'con el id de la distribución como texto',
      { distribuciones: [{ salonId: 5, distribucionId: '3' }] },
    ],
    ['con un inicio sin zona horaria', { inicio: '2026-11-15T20:00:00' }],
    ['con un inicio que es solo fecha', { inicio: '2026-11-15' }],
    ['con un inicio numérico', { inicio: 1_700_000_000_000 }],
    ['con un fin nulo', { fin: null }],
    ['con un fin que no es fecha', { fin: 'mañana' }],
    ['con una hora imposible', { inicio: '2026-11-15T25:00:00.000Z' }],
    ['con confirmarCapacidadExcedida como texto', { confirmarCapacidadExcedida: 'si' }],
    ['con modalidadSalonRestaurante numérica', { modalidadSalonRestaurante: 1 }],
  ])('%s responde 400 VALIDATION_ERROR y no escribe', async (_caso, extra) => {
    const respuesta = await agendar(cuerpo(extra));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
    expect(agendarConDistribucionesMock).not.toHaveBeenCalled();
  });

  it('un body vacío responde 400 con el detalle de distribuciones, inicio y fin', async () => {
    const respuesta = await agendar({});

    expect(respuesta.status).toBe(400);
    const campos = respuesta.body.error.details.map((detalle: { campo: string }) => detalle.campo);
    expect(campos).toEqual(expect.arrayContaining(['distribuciones', 'inicio', 'fin']));
  });

  it('con un id de evento que no es entero positivo responde 400 sin consultar', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const respuesta = await request(app)
        .post(`/api/eventos/${id}/agendar`)
        .set('Cookie', [cookiePersonal])
        .send(cuerpo());
      expect(respuesta.status, id).toBe(400);
    }
    expect(buscarDetalladoMock).not.toHaveBeenCalled();
  });

  // Agendar no cambia el día del evento: un horario en otro día dejaba `fecha` y la reserva del
  // salón apuntando a días distintos.
  it('responde 422 si el horario empieza otro día que el del evento, sin escribir nada', async () => {
    const respuesta = await agendar(
      cuerpo({ inicio: '2026-11-30T17:00:00.000Z', fin: '2026-12-01T01:00:00.000Z' }),
    );

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  // El día se lee en la hora de Córdoba (ADR 0010): las 23:00 del 15 son las 02:00Z del 16.
  it('acepta un inicio a la noche del día del evento aunque en UTC ya sea el día siguiente', async () => {
    const respuesta = await agendar(
      cuerpo({ inicio: '2026-11-16T02:00:00.000Z', fin: '2026-11-16T06:00:00.000Z' }),
    );

    expect(respuesta.status).toBe(200);
    expect(agendarConDistribucionesMock).toHaveBeenCalled();
  });

  it('responde 422 si el inicio cae a la madrugada del día siguiente en Córdoba', async () => {
    const respuesta = await agendar(
      cuerpo({ inicio: '2026-11-16T04:00:00.000Z', fin: '2026-11-16T08:00:00.000Z' }),
    );

    expect(respuesta.status).toBe(422);
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

  it.each(['Cobrado', 'Cancelado'] as const)(
    'responde 409 si el evento ya está %s (HU-23 C2)',
    async (estado) => {
      buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado }));

      const respuesta = await request(app)
        .post('/api/eventos/20/cancelar')
        .set('Cookie', [cookiePersonal]);

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('CONFLICT');
      expect(cancelarMock).not.toHaveBeenCalled();
    },
  );

  it('responde 404 si el evento no existe', async () => {
    buscarDetalladoMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/eventos/99/cancelar')
      .set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(cancelarMock).not.toHaveBeenCalled();
  });

  // HU-23 C3 (decisión del PO, 16/10/2026): las 48 horas aplican solo a un evento confirmado. Una
  // consulta sin seña se cancela en cualquier momento, aunque el evento sea mañana o ya haya pasado.
  it.each([
    ['dentro de una hora', 60 * 60 * 1000],
    ['de mañana', 24 * 60 * 60 * 1000],
    ['de ayer', -24 * 60 * 60 * 1000],
  ])('cancela una consulta EnConsulta %s, sin plazo de 48 horas', async (_caso, desfase) => {
    const inicio = new Date(Date.now() + desfase);
    buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'EnConsulta', inicio }));

    const respuesta = await request(app)
      .post('/api/eventos/20/cancelar')
      .set('Cookie', [cookiePersonal]);

    expect(respuesta.status).toBe(200);
    expect(cancelarMock).toHaveBeenCalledWith(20);
  });

  // RN-07: «hasta 48 horas corridas antes de su inicio». Con exactamente 48 horas todavía se puede;
  // un segundo menos, no. Se congela solo Date para no trabar a supertest.
  describe('en el límite de las 48 horas de un evento Reservado (CP-23-05)', () => {
    const AHORA = new Date('2026-11-10T15:00:00.000Z');

    // El token de sesión vence a las 2 horas: se firma con el reloj ya congelado.
    let cookieAhora = '';

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'], now: AHORA });
      cookieAhora = cookiePersonalNueva();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('con exactamente 48 horas de anticipación cancela', async () => {
      const inicio = new Date(AHORA.getTime() + 48 * 60 * 60 * 1000);
      buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Reservado', inicio }));

      const respuesta = await request(app)
        .post('/api/eventos/20/cancelar')
        .set('Cookie', [cookieAhora]);

      expect(respuesta.status).toBe(200);
      expect(cancelarMock).toHaveBeenCalledWith(20);
    });

    it('con un segundo menos de 48 horas responde 422 y no cancela', async () => {
      const inicio = new Date(AHORA.getTime() + 48 * 60 * 60 * 1000 - 1000);
      buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Reservado', inicio }));

      const respuesta = await request(app)
        .post('/api/eventos/20/cancelar')
        .set('Cookie', [cookieAhora]);

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(cancelarMock).not.toHaveBeenCalled();
    });

    // RN-07: fines de semana y feriados cuentan, no hay calendario de feriados. Un evento del
    // sábado a las 15 se cancela hasta el jueves a las 15, contando las horas corridas.
    it('cuenta las horas corridas aunque el evento caiga en fin de semana', async () => {
      const sabado = new Date('2026-11-14T15:00:00.000Z');
      vi.setSystemTime(new Date('2026-11-12T15:00:00.000Z'));
      cookieAhora = cookiePersonalNueva();
      buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado: 'Reservado', inicio: sabado }));

      const respuesta = await request(app)
        .post('/api/eventos/20/cancelar')
        .set('Cookie', [cookieAhora]);

      expect(respuesta.status).toBe(200);
    });
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
    horaFinEstimada: null as string | null,
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

  const guardarNotas = (cuerpo: object, cookie = cookiePersonal) =>
    request(app)
      .patch('/api/eventos/20/observaciones-comanda')
      .set('Cookie', [cookie])
      .send(cuerpo);

  it('acepta exactamente 2000 caracteres', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture());

    const respuesta = await guardarNotas({ observacionesComanda: 'x'.repeat(2000) });

    expect(respuesta.status).toBe(200);
    expect(guardarObservacionesComandaMock).toHaveBeenCalledWith(20, 'x'.repeat(2000));
  });

  it('guarda saltos de línea, tildes, ñ y emojis: son menús especiales y alergias reales', async () => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture());
    const texto = 'Mesa 3: sin gluten (celíaca)\nMesa 5: menú vegano ñoquis 🌱\nAlergia a maníes';

    const respuesta = await guardarNotas({ observacionesComanda: texto });

    expect(respuesta.status).toBe(200);
    expect(guardarObservacionesComandaMock).toHaveBeenCalledWith(20, texto);
  });

  // La comanda se imprime y el texto lo escribe el personal: el marcado se corta en la entrada.
  it.each(['<script>alert(1)</script>', '2 menús <b>veganos</b>', 'sin sal &amp; sin azúcar'])(
    'rechaza una nota con HTML (%s) y dice qué campo corregir',
    async (observacionesComanda) => {
      buscarDetalladoMock.mockResolvedValue(eventoFixture());

      const respuesta = await guardarNotas({ observacionesComanda });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.details).toEqual([
        { campo: 'observacionesComanda', mensaje: 'No se admite HTML en este campo' },
      ]);
      expect(guardarObservacionesComandaMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['sin el campo', {}],
    ['nula', { observacionesComanda: null }],
    ['numérica', { observacionesComanda: 123 }],
    ['una lista', { observacionesComanda: ['sin sal'] }],
  ])('una nota %s responde 400 y no escribe', async (_caso, cuerpo) => {
    buscarDetalladoMock.mockResolvedValue(eventoFixture());

    const respuesta = await guardarNotas(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(guardarObservacionesComandaMock).not.toHaveBeenCalled();
  });

  it.each(['EnConsulta', 'Reservado', 'Cobrado'] as const)(
    'se puede anotar en un evento %s',
    async (estado) => {
      buscarDetalladoMock.mockResolvedValue(eventoFixture({ estado }));

      const respuesta = await guardarNotas({ observacionesComanda: notas });

      expect(respuesta.status).toBe(200);
    },
  );

  it('sin sesión responde 401 y con sesión de Cliente 403, sin escribir', async () => {
    const cookieCliente = `${NOMBRE_COOKIE_SESION}=${firmarToken({
      id: 7,
      email: 'ana@empresa.com',
      rol: 'CLIENTE',
    })}`;

    const sinSesion = await request(app)
      .patch('/api/eventos/20/observaciones-comanda')
      .send({ observacionesComanda: notas });
    const comoCliente = await guardarNotas({ observacionesComanda: notas }, cookieCliente);

    expect(sinSesion.status).toBe(401);
    expect(comoCliente.status).toBe(403);
    expect(guardarObservacionesComandaMock).not.toHaveBeenCalled();
  });
});
