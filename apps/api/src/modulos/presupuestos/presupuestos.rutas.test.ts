import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';
import { firmarToken, NOMBRE_COOKIE_SESION } from '../../lib/jwt.js';

vi.mock('./presupuestos.repositorio.js', () => ({
  buscarClientePorCorreo: vi.fn(),
  buscarClientePorUsuarioId: vi.fn(),
  crearCliente: vi.fn(),
  buscarSalon: vi.fn(),
  buscarSalonesPorIds: vi.fn(),
  reemplazarSalonesDelEvento: vi.fn(),
  buscarServiciosPorIds: vi.fn(),
  buscarSolicitud: vi.fn(),
  vincularSolicitudAEvento: vi.fn(),
  crearEvento: vi.fn(),
  crearPresupuestoConLineas: vi.fn(),
  buscarEventoConPresupuestos: vi.fn(),
  // No hay transacción real en el test: se ejecuta el callback tal cual, cada función interna
  // que llama ya está mockeada arriba y no usa el `tx` que recibiría de una transacción real.
  crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
  obtenerPresupuestos: vi.fn(),
}));

const {
  buscarClientePorCorreo,
  buscarClientePorUsuarioId,
  crearCliente,
  buscarSalon,
  buscarSalonesPorIds,
  reemplazarSalonesDelEvento,
  buscarServiciosPorIds,
  buscarSolicitud,
  vincularSolicitudAEvento,
  crearEvento,
  crearPresupuestoConLineas,
  buscarEventoConPresupuestos,
  crearEnTransaccion,
  obtenerPresupuestos,
} = await import('./presupuestos.repositorio.js');

const buscarClientePorCorreoMock = vi.mocked(buscarClientePorCorreo);
const buscarClientePorUsuarioIdMock = vi.mocked(buscarClientePorUsuarioId);
const crearClienteMock = vi.mocked(crearCliente);
const buscarSalonMock = vi.mocked(buscarSalon);
const buscarSalonesPorIdsMock = vi.mocked(buscarSalonesPorIds);
const reemplazarSalonesDelEventoMock = vi.mocked(reemplazarSalonesDelEvento);
const buscarServiciosPorIdsMock = vi.mocked(buscarServiciosPorIds);
const buscarSolicitudMock = vi.mocked(buscarSolicitud);
const vincularSolicitudAEventoMock = vi.mocked(vincularSolicitudAEvento);
const crearEventoMock = vi.mocked(crearEvento);
const crearPresupuestoConLineasMock = vi.mocked(crearPresupuestoConLineas);
const buscarEventoConPresupuestosMock = vi.mocked(buscarEventoConPresupuestos);
const crearEnTransaccionMock = vi.mocked(crearEnTransaccion);
const obtenerPresupuestosMock = vi.mocked(obtenerPresupuestos);

const app = crearApp();

const salonFixture = {
  id: 5,
  nombre: 'Paraná',
  capacidadMaxima: 12,
  superficie: 24,
  precioJornadaCompleta: new Prisma.Decimal('142200'),
  precioMediaJornada: new Prisma.Decimal('107900'),
  visibleEnLanding: true,
  fotoUrl: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

function servicioFixture(datos: Partial<typeof servicioFixtureBase> = {}) {
  return { ...servicioFixtureBase, ...datos };
}

const servicioFixtureBase = {
  id: 1,
  nombre: 'Coffee Refresh',
  descripcion: 'Café, tés, leche, jugo, agua con y sin gas',
  unidadMedida: 'persona',
  precio: new Prisma.Decimal('8730') as Prisma.Decimal | null,
  porPersona: true,
  tercerizado: false,
  activo: true,
  categoria: 'Coffee breaks',
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

const eventoFixture = {
  id: 20,
  clienteId: clienteFixture.id,
  fecha: new Date('2026-11-15'),
  inicio: null,
  fin: null,
  cantidadPersonas: 10,
  estado: 'EnConsulta' as const,
  senaVenceEn: null,
  senaRegistradaEn: null,
  tipo: 'Corporativo' as 'Social' | 'Corporativo',
  tipoSocial: null,
  tipoSocialDetalle: null as string | null,
  tipoJornada: null,
  horaInicioEstimada: null as string | null,
  modalidadSalonRestaurante: false,
  observacionesComanda: null as string | null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const solicitudFixture = {
  id: 7,
  clienteId: null,
  nombre: 'Marina Gómez',
  telefono: '+54 9 351 555-1234',
  correo: 'marina@example.com',
  fechaDeseada: new Date('2026-11-15'),
  cantidadPersonas: 10,
  salonId: null,
  descartada: false,
  eventoId: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const bodyBase = {
  nombre: 'Marina Gómez',
  telefono: '+54 9 351 555-1234',
  correo: 'marina@example.com',
  salonIds: [salonFixture.id],
  fecha: '2026-11-15',
  cantidadPersonas: 10,
  tipoJornada: 'completa' as const,
  servicios: [{ servicioId: 1, cantidad: 10 }],
};

// Deja los mocks del repositorio listos para una creación que llega hasta el 201. La usan los
// describes de creación y los de los controles de seguridad (H1, H3 y H5), que también
// necesitan que el camino feliz funcione para distinguir un corte del guard de un 404 o un 422.
function prepararMocksDeCreacion() {
  buscarClientePorCorreoMock.mockReset();
  crearClienteMock.mockReset();
  buscarSalonMock.mockReset();
  buscarSalonesPorIdsMock.mockReset();
  reemplazarSalonesDelEventoMock.mockReset();
  buscarServiciosPorIdsMock.mockReset();
  buscarSolicitudMock.mockReset();
  vincularSolicitudAEventoMock.mockReset();
  crearEventoMock.mockReset();
  crearPresupuestoConLineasMock.mockReset();
  buscarEventoConPresupuestosMock.mockReset();
  crearEnTransaccionMock.mockClear();

  buscarSalonesPorIdsMock.mockResolvedValue([salonFixture]);
  buscarServiciosPorIdsMock.mockResolvedValue([servicioFixture()]);
  crearEventoMock.mockResolvedValue(eventoFixture);
  crearPresupuestoConLineasMock.mockImplementation((datos) =>
    Promise.resolve({
      id: 30,
      eventoId: datos.eventoId,
      estado: 'Estimado' as const,
      fechaEmision: new Date(),
      venceEn: new Date(),
      total: new Prisma.Decimal(datos.total),
      requiereFactura: false,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
      evento: eventoFixture,
      lineas: datos.lineas.map((linea, indice) => ({
        id: indice + 1,
        presupuestoId: 30,
        ...linea,
        precioUnitario: new Prisma.Decimal(linea.precioUnitario),
        subtotal: new Prisma.Decimal(linea.subtotal),
      })),
    }),
  );
}

describe('POST /api/presupuestos', () => {
  beforeEach(prepararMocksDeCreacion);

  it('crea el presupuesto con un cliente nuevo cuando el correo no existe', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(null);
    crearClienteMock.mockResolvedValue(clienteFixture);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodyBase);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.estado).toBe('Estimado');
    expect(respuesta.body.data.lineas).toHaveLength(2); // salón + 1 servicio
    expect(crearClienteMock).toHaveBeenCalledWith(
      { nombre: bodyBase.nombre, telefono: bodyBase.telefono, correo: bodyBase.correo },
      undefined,
    );
  });

  it('emite el presupuesto con vencimiento a los 10 días (HU-10, RN-08)', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);

    await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodyBase);

    const { fechaEmision, venceEn } = crearPresupuestoConLineasMock.mock.calls[0]![0];
    expect(venceEn!.getTime() - fechaEmision.getTime()).toBe(10 * 24 * 60 * 60 * 1000);
  });

  it('crea el evento como corporativo con la jornada y la hora estimada (ADR 0008)', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);

    await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, horaInicioEstimada: '19:30' });

    expect(crearEventoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'Corporativo',
        tipoJornada: bodyBase.tipoJornada,
        horaInicioEstimada: '19:30',
      }),
      undefined,
    );
  });

  it('responde 400 con una hora estimada que no es HH:mm', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, horaInicioEstimada: '25:00' });

    expect(respuesta.status).toBe(400);
    expect(crearEventoMock).not.toHaveBeenCalled();
  });

  it('reutiliza el cliente existente cuando ya hay uno con ese correo', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodyBase);

    expect(respuesta.status).toBe(201);
    expect(crearClienteMock).not.toHaveBeenCalled();
    expect(crearEventoMock).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: clienteFixture.id }),
      undefined,
    );
  });

  it('suma los servicios tercerizados al total, como una línea más', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarServiciosPorIdsMock.mockResolvedValue([
      servicioFixture({ id: 1, precio: new Prisma.Decimal('8730'), tercerizado: false }),
      servicioFixture({
        id: 2,
        nombre: 'Catering externo',
        precio: new Prisma.Decimal('20000'),
        tercerizado: true,
      }),
    ]);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({
        ...bodyBase,
        servicios: [
          { servicioId: 1, cantidad: 10 },
          { servicioId: 2, cantidad: 10 },
        ],
      });

    expect(respuesta.status).toBe(201);
    // total = salón (142200) + servicio 1 (8730*10=87300) + tercerizado (20000*10=200000)
    expect(crearPresupuestoConLineasMock).toHaveBeenCalledWith(
      expect.objectContaining({ total: '429500.00' }),
      undefined,
    );
    const [datos] = crearPresupuestoConLineasMock.mock.calls[0]!;
    expect(datos.lineas).toHaveLength(3); // salón + servicio propio + tercerizado
  });

  it('un tercerizado a cotizar entra sin importe, con la marca, y no suma al total (HU-11)', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarServiciosPorIdsMock.mockResolvedValue([
      servicioFixture({ id: 4, nombre: 'Pantallas LED', precio: null, tercerizado: true }),
    ]);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, servicios: [{ servicioId: 4, cantidad: 1 }] });

    expect(respuesta.status).toBe(201);
    const [datos] = crearPresupuestoConLineasMock.mock.calls[0]!;
    expect(datos.lineas[1]).toEqual({
      servicioId: 4,
      salonId: null,
      descripcion: 'Pantallas LED',
      cantidad: 1,
      precioUnitario: '0.00',
      subtotal: '0.00',
      aCotizar: true,
      horaEstimada: null,
    });
    expect(datos.total).toBe('142200.00'); // solo el salón
  });

  it('calcula la línea de un servicio con una cantidad menor a la del evento (RN-04)', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarServiciosPorIdsMock.mockResolvedValue([servicioFixture()]);

    await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, cantidadPersonas: 80, servicios: [{ servicioId: 1, cantidad: 30 }] });

    const [datos] = crearPresupuestoConLineasMock.mock.calls[0]!;
    const lineaServicio = datos.lineas.find((l) => l.servicioId === 1)!;
    expect(lineaServicio.cantidad).toBe(30);
    expect(lineaServicio.subtotal).toBe('261900.00'); // 8730 * 30
  });

  // El cliente puede decir a qué hora del evento espera cada servicio. El evento recién creado está
  // EnConsulta y todavía no tiene horario, así que acá no hay contra qué validar la hora.
  it('guarda la hora esperada de cada servicio y deja la del salón en null', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarServiciosPorIdsMock.mockResolvedValue([servicioFixture()]);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 10, horaEstimada: '10:30' }] });

    expect(respuesta.status).toBe(201);
    const [datos] = crearPresupuestoConLineasMock.mock.calls[0]!;
    expect(datos.lineas[0]).toMatchObject({ servicioId: null, horaEstimada: null });
    expect(datos.lineas[1]).toMatchObject({ servicioId: 1, horaEstimada: '10:30' });
  });

  it('responde 400 si la hora de un servicio no tiene formato HH:mm', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, servicios: [{ servicioId: 1, cantidad: 10, horaEstimada: '10.30' }] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 404 si el salón no existe', async () => {
    buscarSalonesPorIdsMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodyBase);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 404 si algún servicio seleccionado no existe', async () => {
    buscarServiciosPorIdsMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodyBase);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 422 si algún servicio seleccionado no está activo', async () => {
    buscarServiciosPorIdsMock.mockResolvedValue([servicioFixture({ activo: false })]);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodyBase);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR si no se eligió ningún salón', async () => {
    const { salonIds: _salonIds, ...sinSalon } = bodyBase;

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(sinSalon);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(buscarSalonesPorIdsMock).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR si falta tipoJornada', async () => {
    const { tipoJornada: _tipoJornada, ...sinJornada } = bodyBase;

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(sinJornada);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(buscarSalonesPorIdsMock).not.toHaveBeenCalled();
  });

  it('vincula la solicitud al evento creado cuando viene solicitudId (HU-15)', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarSolicitudMock.mockResolvedValue(solicitudFixture);
    vincularSolicitudAEventoMock.mockResolvedValue({
      ...solicitudFixture,
      eventoId: eventoFixture.id,
    });

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, solicitudId: solicitudFixture.id });

    expect(respuesta.status).toBe(201);
    expect(buscarSolicitudMock).toHaveBeenCalledWith(solicitudFixture.id);
    expect(vincularSolicitudAEventoMock).toHaveBeenCalledWith(
      solicitudFixture.id,
      eventoFixture.id,
      undefined,
    );
  });

  it('responde 409 si la solicitud indicada ya fue tomada', async () => {
    buscarSolicitudMock.mockResolvedValue({ ...solicitudFixture, eventoId: 999 });

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, solicitudId: solicitudFixture.id });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });
});

// H1 de la auditoría de seguridad: la ruta estaba montada sin autenticar ni autorizar.
describe('POST /api/presupuestos — guard de sesión (H1)', () => {
  beforeEach(prepararMocksDeCreacion);

  it('sin sesión responde 401 y no escribe nada en la base', async () => {
    const respuesta = await request(app).post('/api/presupuestos').send(bodyBase);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('también cotiza el personal, que carga el pedido de quien llama por teléfono', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
      .send(bodyBase);

    expect(respuesta.status).toBe(201);
  });
});

// H3 de la auditoría de seguridad: el marcado en los campos de texto se rechaza en la entrada.
describe('Rechazo de HTML en el cuerpo (H3)', () => {
  beforeEach(prepararMocksDeCreacion);

  it('responde 400 e indica el campo con marcado', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, nombre: '<img src=x onerror=alert(1)>' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details).toEqual([
      { campo: 'nombre', mensaje: 'No se admite HTML en este campo' },
    ]);
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('deja pasar un nombre normal, con tildes y apóstrofos', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, nombre: "Martín O'Connor & Asociados" });

    expect(respuesta.status).toBe(201);
  });
});

// H5 de la auditoría de seguridad: CSRF explícito por verificación de origen.
describe('Verificación de origen en las escrituras (H5)', () => {
  beforeEach(prepararMocksDeCreacion);

  it('rechaza con 403 un POST que llega desde otro sitio con la cookie de la víctima', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .set('Origin', 'https://sitio-del-atacante.test')
      .send(bodyBase);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('deja pasar el POST que llega desde la web del proyecto', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .set('Origin', 'http://localhost:5173')
      .send(bodyBase);

    expect(respuesta.status).toBe(201);
  });

  it('no toca las lecturas: un GET desde otro origen sigue respondiendo normal', async () => {
    obtenerPresupuestosMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .get('/api/presupuestos')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
      .set('Origin', 'https://sitio-del-atacante.test');

    expect(respuesta.status).toBe(200);
  });
});

function cookieDe(
  rol: 'RESPONSABLE_EVENTOS' | 'ADMINISTRADOR_SISTEMA' | 'RESPONSABLE_FINANZAS' | 'CLIENTE',
) {
  return `${NOMBRE_COOKIE_SESION}=${firmarToken({ id: 1, email: 'personal@confluens.test', rol })}`;
}

const presupuestoDelListado = {
  id: 31,
  eventoId: 20,
  estado: 'Expirado' as const,
  fechaEmision: new Date('2026-09-20T15:00:00.000Z'),
  venceEn: new Date('2026-09-30T15:00:00.000Z'),
  total: new Prisma.Decimal('229500'),
  evento: {
    fecha: new Date('2026-11-15T00:00:00.000Z'),
    tipo: 'Corporativo' as 'Social' | 'Corporativo',
    tipoSocial: null as 'Casamiento' | null,
    tipoSocialDetalle: null,
    salones: [{ salon: { id: 5, nombre: 'Paraná' } }] as {
      salon: { id: number; nombre: string };
    }[],
    cliente: {
      id: 10,
      nombre: 'Marina',
      apellido: 'Gómez',
      correo: 'marina@example.com',
      etiqueta: { id: 4, nombre: 'Empresa1' } as { id: number; nombre: string } | null,
    },
  },
};

describe('GET /api/presupuestos (HU-10)', () => {
  beforeEach(() => {
    obtenerPresupuestosMock.mockReset();
    obtenerPresupuestosMock.mockResolvedValue([presupuestoDelListado]);
  });

  it('lista cada presupuesto con número, cliente (con su etiqueta), salón, fechas, total y estado', async () => {
    const respuesta = await request(app)
      .get('/api/presupuestos')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: [
        {
          id: 31,
          eventoId: 20,
          estado: 'Expirado',
          fechaEmision: '2026-09-20T15:00:00.000Z',
          venceEn: '2026-09-30T15:00:00.000Z',
          total: '229500.00',
          fechaEvento: '2026-11-15',
          tipo: 'Corporativo',
          tipoSocial: null,
          tipoSocialDetalle: null,
          cliente: {
            id: 10,
            nombre: 'Marina',
            apellido: 'Gómez',
            correo: 'marina@example.com',
            etiqueta: { id: 4, nombre: 'Empresa1' },
          },
          salones: [{ id: 5, nombre: 'Paraná' }],
        },
      ],
    });
  });

  it('una consulta social sin armar viene sin salón ni vencimiento, con su tipo (ADR 0008)', async () => {
    obtenerPresupuestosMock.mockResolvedValue([
      {
        ...presupuestoDelListado,
        estado: 'Estimado' as never,
        venceEn: null as never,
        total: new Prisma.Decimal('0'),
        evento: {
          ...presupuestoDelListado.evento,
          tipo: 'Social',
          tipoSocial: 'Casamiento',
          salones: [],
        },
      },
    ]);

    const respuesta = await request(app)
      .get('/api/presupuestos')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data[0]).toMatchObject({
      venceEn: null,
      total: '0.00',
      tipo: 'Social',
      tipoSocial: 'Casamiento',
      salones: [],
    });
  });

  it('pasa al repositorio los filtros de estado, cliente y rango de fechas del evento', async () => {
    await request(app)
      .get('/api/presupuestos')
      .query({
        estado: 'Estimado',
        cliente: '  Marina Gómez ',
        desde: '2026-11-01',
        hasta: '2026-11-30',
      })
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(obtenerPresupuestosMock).toHaveBeenCalledWith({
      estado: 'Estimado',
      cliente: 'Marina Gómez',
      desde: '2026-11-01',
      hasta: '2026-11-30',
    });
  });

  it('toma los filtros vacíos como ausentes', async () => {
    const respuesta = await request(app)
      .get('/api/presupuestos?estado=&cliente=&desde=&hasta=')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(200);
    expect(obtenerPresupuestosMock).toHaveBeenCalledWith({});
  });

  it('responde una lista vacía si ningún presupuesto cumple los filtros', async () => {
    obtenerPresupuestosMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .get('/api/presupuestos?estado=Cancelado')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: [] });
  });

  it('responde 400 VALIDATION_ERROR con un estado que no existe', async () => {
    const respuesta = await request(app)
      .get('/api/presupuestos?estado=Vencido')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(obtenerPresupuestosMock).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR si se filtra por Confirmado, que no se lista', async () => {
    const respuesta = await request(app)
      .get('/api/presupuestos?estado=Confirmado')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(400);
    expect(obtenerPresupuestosMock).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR si la fecha hasta es anterior a la fecha desde', async () => {
    const respuesta = await request(app)
      .get('/api/presupuestos?desde=2026-11-30&hasta=2026-11-01')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details).toEqual([
      { campo: 'hasta', mensaje: 'La fecha hasta no puede ser anterior a la fecha desde' },
    ]);
  });

  it('el Administrador del Sistema también accede', async () => {
    const respuesta = await request(app)
      .get('/api/presupuestos')
      .set('Cookie', [cookieDe('ADMINISTRADOR_SISTEMA')]);

    expect(respuesta.status).toBe(200);
  });

  it('sin cookie de sesión responde 401 UNAUTHENTICATED', async () => {
    const respuesta = await request(app).get('/api/presupuestos');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  // Provisorio (06/10/2026): todo el personal ve las consultas hasta que se dividan las funciones.
  it('otro rol del personal también accede', async () => {
    const respuesta = await request(app)
      .get('/api/presupuestos')
      .set('Cookie', [cookieDe('RESPONSABLE_FINANZAS')]);

    expect(respuesta.status).toBe(200);
  });

  it('con sesión de Cliente responde 403 FORBIDDEN', async () => {
    const respuesta = await request(app)
      .get('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')]);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/presupuestos/social (ADR 0008)', () => {
  const bodySocial = {
    fecha: '2026-12-05',
    cantidadPersonas: 120,
    tipoJornada: 'completa',
    horaInicioEstimada: '21:00',
    tipoSocial: 'Casamiento',
  };
  const clienteConCuenta = { ...clienteFixture, usuarioId: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    buscarClientePorUsuarioIdMock.mockResolvedValue(clienteConCuenta);
    crearEventoMock.mockResolvedValue({ ...eventoFixture, tipo: 'Social' } as never);
    crearPresupuestoConLineasMock.mockImplementation(
      async (datos) =>
        ({
          id: 40,
          eventoId: datos.eventoId,
          estado: 'Estimado',
          fechaEmision: datos.fechaEmision,
          venceEn: datos.venceEn,
          total: new Prisma.Decimal(datos.total),
          requiereFactura: false,
          creadoEn: new Date(),
          actualizadoEn: new Date(),
          evento: { ...eventoFixture, tipo: 'Social', salonId: null },
          lineas: [],
        }) as never,
    );
  });

  it('crea el evento social sin salón, del cliente de la sesión, con el presupuesto sin armar', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos/social')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodySocial);

    expect(respuesta.status).toBe(201);
    expect(buscarClientePorUsuarioIdMock).toHaveBeenCalledWith(1);
    expect(crearClienteMock).not.toHaveBeenCalled();
    expect(crearEventoMock).toHaveBeenCalledWith(
      {
        clienteId: clienteConCuenta.id,
        fecha: new Date('2026-12-05'),
        cantidadPersonas: 120,
        tipo: 'Social',
        tipoSocial: 'Casamiento',
        tipoSocialDetalle: null,
        tipoJornada: 'completa',
        horaInicioEstimada: '21:00',
      },
      undefined,
    );
    expect(crearPresupuestoConLineasMock).toHaveBeenCalledWith(
      expect.objectContaining({ venceEn: null, total: '0.00', lineas: [] }),
      undefined,
    );
    expect(respuesta.body.data).toMatchObject({ venceEn: null, total: '0', lineas: [] });
  });

  it('guarda el detalle cuando el tipo es Otro', async () => {
    await request(app)
      .post('/api/presupuestos/social')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodySocial, tipoSocial: 'Otro', tipoSocialDetalle: 'Despedida de soltera' });

    expect(crearEventoMock).toHaveBeenCalledWith(
      expect.objectContaining({ tipoSocial: 'Otro', tipoSocialDetalle: 'Despedida de soltera' }),
      undefined,
    );
  });

  it('vincula la solicitud del formulario al evento', async () => {
    buscarSolicitudMock.mockResolvedValue(solicitudFixture);

    await request(app)
      .post('/api/presupuestos/social')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodySocial, solicitudId: solicitudFixture.id });

    expect(vincularSolicitudAEventoMock).toHaveBeenCalledWith(
      solicitudFixture.id,
      eventoFixture.id,
      undefined,
    );
  });

  it('responde 400 si el tipo es Otro y no cuenta qué evento es', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos/social')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodySocial, tipoSocial: 'Otro' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details).toEqual([
      { campo: 'tipoSocialDetalle', mensaje: 'Contanos qué evento es' },
    ]);
    expect(crearEventoMock).not.toHaveBeenCalled();
  });

  it('responde 400 sin tipo social o con una hora inválida', async () => {
    const sinTipo = await request(app)
      .post('/api/presupuestos/social')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodySocial, tipoSocial: undefined });
    const horaInvalida = await request(app)
      .post('/api/presupuestos/social')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodySocial, horaInicioEstimada: '9 pm' });

    expect(sinTipo.status).toBe(400);
    expect(horaInvalida.status).toBe(400);
  });

  it('responde 404 si la sesión no tiene ficha de cliente', async () => {
    buscarClientePorUsuarioIdMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .post('/api/presupuestos/social')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send(bodySocial);

    expect(respuesta.status).toBe(404);
    expect(crearEventoMock).not.toHaveBeenCalled();
  });

  it('sin sesión responde 401 y con sesión del personal 403', async () => {
    const sinSesion = await request(app).post('/api/presupuestos/social').send(bodySocial);
    const personal = await request(app)
      .post('/api/presupuestos/social')
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')])
      .send(bodySocial);

    expect(sinSesion.status).toBe(401);
    expect(personal.status).toBe(403);
    expect(crearEventoMock).not.toHaveBeenCalled();
  });
});

// El presupuesto vacío de un evento que ya existe: el equivalente a lo que la consulta social crea
// junto con el evento, para los eventos que llegaron sin ninguno.
describe('POST /api/presupuestos/para-evento/:eventoId', () => {
  beforeEach(prepararMocksDeCreacion);

  const url = '/api/presupuestos/para-evento/20';

  it('crea el presupuesto sin armar: sin líneas, total 0 y sin vigencia', async () => {
    buscarEventoConPresupuestosMock.mockResolvedValue({
      id: 20,
      estado: 'EnConsulta',
      presupuestos: [],
    });

    const respuesta = await request(app)
      .post(url)
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(201);
    expect(crearPresupuestoConLineasMock.mock.calls[0]![0]).toMatchObject({
      eventoId: 20,
      venceEn: null,
      total: '0.00',
      lineas: [],
    });
  });

  it('no cuenta los presupuestos dados de baja', async () => {
    buscarEventoConPresupuestosMock.mockResolvedValue({
      id: 20,
      estado: 'EnConsulta',
      presupuestos: [{ id: 9, estado: 'Cancelado' }],
    });

    const respuesta = await request(app)
      .post(url)
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(201);
  });

  it('responde 404 si el evento no existe', async () => {
    buscarEventoConPresupuestosMock.mockResolvedValue(null);

    const respuesta = await request(app)
      .post(url)
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearPresupuestoConLineasMock).not.toHaveBeenCalled();
  });

  it('responde 409 si el evento ya tiene un presupuesto', async () => {
    buscarEventoConPresupuestosMock.mockResolvedValue({
      id: 20,
      estado: 'EnConsulta',
      presupuestos: [{ id: 9, estado: 'Estimado' }],
    });

    const respuesta = await request(app)
      .post(url)
      .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

    expect(respuesta.status).toBe(409);
    expect(crearPresupuestoConLineasMock).not.toHaveBeenCalled();
  });

  it.each(['Reservado', 'Cobrado', 'Cancelado'] as const)(
    'responde 409 si el evento está %s',
    async (estado) => {
      buscarEventoConPresupuestosMock.mockResolvedValue({ id: 20, estado, presupuestos: [] });

      const respuesta = await request(app)
        .post(url)
        .set('Cookie', [cookieDe('RESPONSABLE_EVENTOS')]);

      expect(respuesta.status).toBe(409);
      expect(crearPresupuestoConLineasMock).not.toHaveBeenCalled();
    },
  );

  it('sin sesión responde 401 y con sesión de cliente 403', async () => {
    const sinSesion = await request(app).post(url);
    const cliente = await request(app)
      .post(url)
      .set('Cookie', [cookieDe('CLIENTE')]);

    expect(sinSesion.status).toBe(401);
    expect(cliente.status).toBe(403);
    expect(buscarEventoConPresupuestosMock).not.toHaveBeenCalled();
  });
});

// ADR 0011: un evento puede ocupar varios salones a la vez, hasta los cinco.
describe('POST /api/presupuestos — varios salones', () => {
  const pucara = { ...salonFixture, id: 9, nombre: 'Pucará' };

  it('emite una línea por salón, en el orden en que se eligieron', async () => {
    prepararMocksDeCreacion();
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    // El repositorio devuelve por id, no en el orden pedido: el servicio reordena.
    buscarSalonesPorIdsMock.mockResolvedValue([salonFixture, pucara]);
    buscarServiciosPorIdsMock.mockResolvedValue([]);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, salonIds: [pucara.id, salonFixture.id], servicios: [] });

    expect(respuesta.status).toBe(201);
    const [datos] = crearPresupuestoConLineasMock.mock.calls[0]!;
    expect(datos.lineas.map((l) => l.salonId)).toEqual([pucara.id, salonFixture.id]);
    expect(datos.lineas.map((l) => l.descripcion)).toEqual([
      'Salón Pucará (jornada completa)',
      `Salón ${salonFixture.nombre} (jornada completa)`,
    ]);
  });

  it('vincula al evento todos los salones elegidos', async () => {
    prepararMocksDeCreacion();
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarSalonesPorIdsMock.mockResolvedValue([salonFixture, pucara]);
    buscarServiciosPorIdsMock.mockResolvedValue([]);

    await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, salonIds: [salonFixture.id, pucara.id], servicios: [] });

    const [, salonesVinculados] = reemplazarSalonesDelEventoMock.mock.calls[0]!;
    expect(salonesVinculados).toEqual([salonFixture.id, pucara.id]);
  });

  it('el total suma el alquiler de cada salón', async () => {
    prepararMocksDeCreacion();
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarSalonesPorIdsMock.mockResolvedValue([salonFixture, pucara]);
    buscarServiciosPorIdsMock.mockResolvedValue([]);

    await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, salonIds: [salonFixture.id, pucara.id], servicios: [] });

    const [datos] = crearPresupuestoConLineasMock.mock.calls[0]!;
    const esperado = datos.lineas.reduce((suma, l) => suma + Number(l.subtotal), 0);
    expect(Number(datos.total)).toBe(esperado);
  });

  it('responde 404 si alguno de los salones no existe, sin crear nada', async () => {
    prepararMocksDeCreacion();
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarSalonesPorIdsMock.mockResolvedValue([salonFixture]);

    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, salonIds: [salonFixture.id, 404] });

    expect(respuesta.status).toBe(404);
    expect(crearPresupuestoConLineasMock).not.toHaveBeenCalled();
  });

  it('responde 400 si el mismo salón viene repetido', async () => {
    const respuesta = await request(app)
      .post('/api/presupuestos')
      .set('Cookie', [cookieDe('CLIENTE')])
      .send({ ...bodyBase, salonIds: [salonFixture.id, salonFixture.id] });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});
