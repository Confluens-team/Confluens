import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crearApp } from '../../app.js';
import { Prisma } from '../../generated/prisma/client.js';

vi.mock('./presupuestos.repositorio.js', () => ({
  buscarClientePorCorreo: vi.fn(),
  crearCliente: vi.fn(),
  buscarSalon: vi.fn(),
  buscarServiciosPorIds: vi.fn(),
  buscarSolicitud: vi.fn(),
  vincularSolicitudAEvento: vi.fn(),
  crearEvento: vi.fn(),
  crearPresupuestoConLineas: vi.fn(),
  // No hay transacción real en el test: se ejecuta el callback tal cual, cada función interna
  // que llama ya está mockeada arriba y no usa el `tx` que recibiría de una transacción real.
  crearEnTransaccion: vi.fn((ejecutar: (tx: undefined) => unknown) => ejecutar(undefined)),
}));

const {
  buscarClientePorCorreo,
  crearCliente,
  buscarSalon,
  buscarServiciosPorIds,
  buscarSolicitud,
  vincularSolicitudAEvento,
  crearEvento,
  crearPresupuestoConLineas,
  crearEnTransaccion,
} = await import('./presupuestos.repositorio.js');

const buscarClientePorCorreoMock = vi.mocked(buscarClientePorCorreo);
const crearClienteMock = vi.mocked(crearCliente);
const buscarSalonMock = vi.mocked(buscarSalon);
const buscarServiciosPorIdsMock = vi.mocked(buscarServiciosPorIds);
const buscarSolicitudMock = vi.mocked(buscarSolicitud);
const vincularSolicitudAEventoMock = vi.mocked(vincularSolicitudAEvento);
const crearEventoMock = vi.mocked(crearEvento);
const crearPresupuestoConLineasMock = vi.mocked(crearPresupuestoConLineas);
const crearEnTransaccionMock = vi.mocked(crearEnTransaccion);

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
  precio: new Prisma.Decimal('8730'),
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
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

const eventoFixture = {
  id: 20,
  clienteId: clienteFixture.id,
  salonId: salonFixture.id,
  distribucionId: null,
  fecha: new Date('2026-11-15'),
  inicio: null,
  fin: null,
  cantidadPersonas: 10,
  estado: 'EnConsulta' as const,
  senaVenceEn: null,
  senaRegistradaEn: null,
  modalidadSalonRestaurante: false,
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
  salonId: salonFixture.id,
  fecha: '2026-11-15',
  cantidadPersonas: 10,
  tipoJornada: 'completa' as const,
  servicios: [{ servicioId: 1, cantidad: 10 }],
};

describe('POST /api/presupuestos', () => {
  beforeEach(() => {
    buscarClientePorCorreoMock.mockReset();
    crearClienteMock.mockReset();
    buscarSalonMock.mockReset();
    buscarServiciosPorIdsMock.mockReset();
    buscarSolicitudMock.mockReset();
    vincularSolicitudAEventoMock.mockReset();
    crearEventoMock.mockReset();
    crearPresupuestoConLineasMock.mockReset();
    crearEnTransaccionMock.mockClear();

    buscarSalonMock.mockResolvedValue(salonFixture);
    buscarServiciosPorIdsMock.mockResolvedValue([servicioFixture()]);
    crearEventoMock.mockResolvedValue(eventoFixture);
    crearPresupuestoConLineasMock.mockImplementation((datos) =>
      Promise.resolve({
        id: 30,
        eventoId: datos.eventoId,
        estado: 'Estimado' as const,
        fechaEmision: new Date(),
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
  });

  it('crea el presupuesto con un cliente nuevo cuando el correo no existe', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(null);
    crearClienteMock.mockResolvedValue(clienteFixture);

    const respuesta = await request(app).post('/api/presupuestos').send(bodyBase);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.estado).toBe('Estimado');
    expect(respuesta.body.data.lineas).toHaveLength(2); // salón + 1 servicio
    expect(crearClienteMock).toHaveBeenCalledWith(
      { nombre: bodyBase.nombre, telefono: bodyBase.telefono, correo: bodyBase.correo },
      undefined,
    );
  });

  it('reutiliza el cliente existente cuando ya hay uno con ese correo', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);

    const respuesta = await request(app).post('/api/presupuestos').send(bodyBase);

    expect(respuesta.status).toBe(201);
    expect(crearClienteMock).not.toHaveBeenCalled();
    expect(crearEventoMock).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: clienteFixture.id }),
      undefined,
    );
  });

  it('excluye los servicios tercerizados del total pero los incluye como línea', async () => {
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
      .send({
        ...bodyBase,
        servicios: [
          { servicioId: 1, cantidad: 10 },
          { servicioId: 2, cantidad: 10 },
        ],
      });

    expect(respuesta.status).toBe(201);
    // total = salón (142200) + servicio 1 (8730*10=87300), sin el tercerizado (20000*10=200000)
    expect(crearPresupuestoConLineasMock).toHaveBeenCalledWith(
      expect.objectContaining({ total: '229500.00' }),
      undefined,
    );
    const [datos] = crearPresupuestoConLineasMock.mock.calls[0]!;
    expect(datos.lineas).toHaveLength(3); // salón + servicio no tercerizado + tercerizado
  });

  it('calcula la línea de un servicio con una cantidad menor a la del evento (RN-04)', async () => {
    buscarClientePorCorreoMock.mockResolvedValue(clienteFixture);
    buscarServiciosPorIdsMock.mockResolvedValue([servicioFixture()]);

    await request(app)
      .post('/api/presupuestos')
      .send({ ...bodyBase, cantidadPersonas: 80, servicios: [{ servicioId: 1, cantidad: 30 }] });

    const [datos] = crearPresupuestoConLineasMock.mock.calls[0]!;
    const lineaServicio = datos.lineas.find((l) => l.servicioId === 1)!;
    expect(lineaServicio.cantidad).toBe(30);
    expect(lineaServicio.subtotal).toBe('261900.00'); // 8730 * 30
  });

  it('responde 404 si el salón no existe', async () => {
    buscarSalonMock.mockResolvedValue(null);

    const respuesta = await request(app).post('/api/presupuestos').send(bodyBase);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 404 si algún servicio seleccionado no existe', async () => {
    buscarServiciosPorIdsMock.mockResolvedValue([]);

    const respuesta = await request(app).post('/api/presupuestos').send(bodyBase);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 422 si algún servicio seleccionado no está activo', async () => {
    buscarServiciosPorIdsMock.mockResolvedValue([servicioFixture({ activo: false })]);

    const respuesta = await request(app).post('/api/presupuestos').send(bodyBase);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR si falta salonId', async () => {
    const { salonId: _salonId, ...sinSalon } = bodyBase;

    const respuesta = await request(app).post('/api/presupuestos').send(sinSalon);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(buscarSalonMock).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR si falta tipoJornada', async () => {
    const { tipoJornada: _tipoJornada, ...sinJornada } = bodyBase;

    const respuesta = await request(app).post('/api/presupuestos').send(sinJornada);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(buscarSalonMock).not.toHaveBeenCalled();
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
      .send({ ...bodyBase, solicitudId: solicitudFixture.id });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('CONFLICT');
    expect(crearEnTransaccionMock).not.toHaveBeenCalled();
  });
});
