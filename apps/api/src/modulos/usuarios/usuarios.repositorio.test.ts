import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-31 del Sprint 4: que no se listen los clientes, el orden y que nunca se lea el hash se deciden
// en la consulta, así que se prueban acá con un Prisma falso (sin Postgres; ver ADR 0003).
const usuario = { findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
const auditLog = { create: vi.fn() };

// $transaction corre el callback con el mismo cliente falso.
vi.mock('../../lib/prisma.js', () => {
  const prisma: Record<string, unknown> = { usuario, auditLog };
  prisma['$transaction'] = (ejecutar: (tx: unknown) => unknown) => ejecutar(prisma);
  return { prisma };
});

const { conActor } = await import('../../lib/auditoria.js');
const { cambiarContrasena, crear, listar } = await import('./usuarios.repositorio.js');
const comoAdm = <T>(ejecutar: () => T) =>
  conActor({ usuarioId: 9, rol: 'ADMINISTRADOR_SISTEMA' }, ejecutar);

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
    usuario.create.mockResolvedValue({ id: 4, email: 'a@confluens.test' });
    await comoAdm(() =>
      crear({
        email: 'a@confluens.test',
        hashContrasena: '$2b$10$hash',
        rol: 'RESPONSABLE_FINANZAS',
      }),
    );

    expect(usuario.create.mock.calls[0]![0].select).not.toHaveProperty('hashContrasena');
  });

  // HU-25 del backlog: la auditoría registra que la contraseña cambió, nunca el hash.
  it('al cambiar la contraseña audita el cambio sin el hash', async () => {
    await comoAdm(() => cambiarContrasena(4, '$2b$10$secreto'));

    const fila = auditLog.create.mock.calls[0]![0].data;
    expect(fila).toMatchObject({ usuarioId: 9, entidad: 'Usuario', entidadId: '4' });
    expect(fila.valorNuevo).toEqual({ contrasena: '(cambiada)' });
    expect(JSON.stringify(fila)).not.toContain('secreto');
  });
});
