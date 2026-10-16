import { beforeEach, describe, expect, it, vi } from 'vitest';

// HU-16: la búsqueda se arma en la consulta de Prisma, así que se prueba qué recibe findMany con un
// cliente falso (sin Postgres, igual que presupuestos.repositorio.test.ts).
const findMany = vi.fn();

vi.mock('../../lib/prisma.js', () => ({ prisma: { cliente: { findMany } } }));

const { listarConResumen } = await import('./clientes.repositorio.js');

const OR = (palabra: string) => ({
  OR: [
    { nombre: { contains: palabra, mode: 'insensitive' } },
    { apellido: { contains: palabra, mode: 'insensitive' } },
    { correo: { contains: palabra, mode: 'insensitive' } },
    { telefono: { contains: palabra, mode: 'insensitive' } },
    { etiqueta: { nombre: { contains: palabra, mode: 'insensitive' } } },
  ],
});

describe('clientes.repositorio: listarConResumen', () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  it('sin búsqueda no filtra', async () => {
    await listarConResumen();

    expect(findMany.mock.calls[0]![0].where).toEqual({ AND: [] });
  });

  // CP-16-02 y CP-16-03: cada palabra tiene que aparecer en algún dato, sin distinguir mayúsculas.
  it('cada palabra tiene que aparecer en el nombre, el apellido, el correo, el teléfono o la etiqueta', async () => {
    await listarConResumen('Ana  Ruiz');

    expect(findMany.mock.calls[0]![0].where).toEqual({ AND: [OR('Ana'), OR('Ruiz')] });
  });

  it('trae la etiqueta y los contadores de eventos y solicitudes', async () => {
    await listarConResumen();

    expect(findMany.mock.calls[0]![0].include).toEqual({
      etiqueta: { select: { id: true, nombre: true } },
      _count: { select: { eventos: true, solicitudes: true } },
    });
  });
});
