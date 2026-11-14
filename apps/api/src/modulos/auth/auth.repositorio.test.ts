import { beforeEach, describe, expect, it, vi } from 'vitest';

// C7 de HU-48: la decisión de vincular o crear la ficha vive en la transacción del repositorio, así
// que se prueba acá con un cliente de transacción falso (sin Postgres, igual que el resto de los
// tests de la API; ver ADR 0003).
const tx = {
  usuario: { create: vi.fn() },
  cliente: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
};

// vi.hoisted: la fábrica de vi.mock se ejecuta antes que las constantes del módulo.
const usuarioUpdateMany = vi.hoisted(() => vi.fn());

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    $transaction: (ejecutar: (cliente: typeof tx) => unknown) => ejecutar(tx),
    usuario: { updateMany: usuarioUpdateMany },
  },
}));

const { crearUsuarioCliente, invalidarSesiones } = await import('./auth.repositorio.js');

const datos = {
  email: 'ana@empresa.com',
  hashContrasena: '$2b$10$hash',
  nombre: 'Ana',
  apellido: 'Pérez',
  telefono: '+5493515551234',
};

describe('auth.repositorio: crearUsuarioCliente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.usuario.create.mockResolvedValue({ id: 7, email: datos.email, rol: 'CLIENTE' });
  });

  it('si ya existe una ficha con ese correo sin cuenta, le vincula la cuenta y no crea otra (C7)', async () => {
    tx.cliente.findFirst.mockResolvedValue({
      id: 3,
      correo: datos.email,
      telefono: '351-555 1234',
      usuarioId: null,
    });

    await crearUsuarioCliente(datos);

    expect(tx.cliente.findFirst).toHaveBeenCalledWith({
      where: { correo: datos.email, usuarioId: null },
    });
    // El teléfono que cargó el personal se reemplaza por el celular validado, el que usa wa.me.
    expect(tx.cliente.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { usuarioId: 7, telefono: '+5493515551234' },
    });
    expect(tx.cliente.create).not.toHaveBeenCalled();
  });

  it('si no hay ficha previa, crea la cuenta con rol CLIENTE junto con su ficha (C1)', async () => {
    tx.cliente.findFirst.mockResolvedValue(null);

    await crearUsuarioCliente(datos);

    expect(tx.usuario.create).toHaveBeenCalledWith({
      data: { email: datos.email, hashContrasena: datos.hashContrasena, rol: 'CLIENTE' },
    });
    expect(tx.cliente.create).toHaveBeenCalledWith({
      data: {
        nombre: 'Ana',
        apellido: 'Pérez',
        telefono: '+5493515551234',
        correo: datos.email,
        usuarioId: 7,
      },
    });
    expect(tx.cliente.update).not.toHaveBeenCalled();
  });
});

describe('auth.repositorio: invalidarSesiones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usuarioUpdateMany.mockResolvedValue({ count: 1 });
  });

  // La condición por versión es la que deja sin efecto un token ya invalidado: con la versión
  // vieja el update no encuentra la fila y la sesión que el usuario abrió después sigue viva.
  it('sube la versión solo si la del token sigue siendo la vigente', async () => {
    await invalidarSesiones(9, 2);

    expect(usuarioUpdateMany).toHaveBeenCalledWith({
      where: { id: 9, versionSesion: 2 },
      data: { versionSesion: { increment: 1 }, ultimaActividad: null },
    });
  });

  // Estado de conexión de Personal: sin sesión no hay «última actividad», así que pasa a «sin
  // sesión» de inmediato y no recién cuando vence la ventana de 2 horas.
  it('al cerrar sesión borra la marca de última actividad', async () => {
    await invalidarSesiones(9, 2);

    expect(usuarioUpdateMany.mock.calls[0]![0].data.ultimaActividad).toBeNull();
  });
});
