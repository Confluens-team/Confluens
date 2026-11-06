import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-31 del Sprint 4: que no se listen los clientes, el orden y que nunca se lea el hash se deciden
// en la consulta, así que se prueban acá con un Prisma falso (sin Postgres; ver ADR 0003).
const usuario = { findMany: vi.fn(), create: vi.fn() };

vi.mock('../../lib/prisma.js', () => ({ prisma: { usuario } }));

const { crear, listar } = await import('./usuarios.repositorio.js');

describe('usuarios.repositorio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usuario.findMany.mockResolvedValue([]);
  });

  it('sin filtro lista todo el personal y deja afuera a los clientes, por rol y después por correo', async () => {
    await listar();

    const consulta = usuario.findMany.mock.calls[0]![0];
    expect(consulta.where).toEqual({ rol: { not: 'CLIENTE' } });
    expect(consulta.orderBy).toEqual([{ rol: 'asc' }, { email: 'asc' }]);
    expect(consulta.select).not.toHaveProperty('hashContrasena');
  });

  it('con filtro lista solo ese rol', async () => {
    await listar('GERENTE_GENERAL');

    expect(usuario.findMany.mock.calls[0]![0].where).toEqual({ rol: 'GERENTE_GENERAL' });
  });

  it('al crear no devuelve el hash', async () => {
    await crear({
      email: 'a@confluens.test',
      hashContrasena: '$2b$10$hash',
      rol: 'RESPONSABLE_FINANZAS',
    });

    expect(usuario.create.mock.calls[0]![0].select).not.toHaveProperty('hashContrasena');
  });
});
