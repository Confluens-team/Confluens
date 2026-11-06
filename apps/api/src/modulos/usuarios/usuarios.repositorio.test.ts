import { beforeEach, describe, expect, it, vi } from 'vitest';

// Que nunca se lea el hash se decide en la consulta, así que se prueba acá con un Prisma falso (sin
// Postgres; ver ADR 0003).
const usuario = { create: vi.fn() };

vi.mock('../../lib/prisma.js', () => ({ prisma: { usuario } }));

const { crear } = await import('./usuarios.repositorio.js');

describe('usuarios.repositorio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
