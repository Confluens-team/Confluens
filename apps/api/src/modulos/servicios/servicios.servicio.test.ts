import { describe, expect, it } from 'vitest';

import type { Servicio } from '../../generated/prisma/client.js';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace.js';
import type { ServiciosRepositorio } from './servicios.repositorio.js';
import { crearServicio, listarServicios } from './servicios.servicio.js';

// Repositorio fake: crearServicio()/listarServicios() reciben el repositorio real como default
// param, así que acá se lo reemplaza por un array en memoria. Ni toca Prisma ni necesita una base
// de datos corriendo (mismo criterio que auth.servicio.test.ts en HU-27).
function repositorioFake(servicios: Servicio[]): ServiciosRepositorio {
  return {
    listarActivos: async () => servicios.filter((s) => s.activo),
    listarPublicos: async () =>
      servicios
        .filter((s) => s.activo)
        .map(({ id, nombre, descripcion, categoria, fotoUrl }) => ({
          id,
          nombre,
          descripcion,
          categoria,
          fotoUrl,
        })),
    buscarPorNombre: async (nombre) => servicios.find((s) => s.nombre === nombre) ?? null,
    buscarPorId: async (id) => servicios.find((s) => s.id === id) ?? null,
    actualizarLanding: async (id, fotoUrl) => {
      const servicio = servicios.find((s) => s.id === id)!;
      servicio.fotoUrl = fotoUrl;
      return servicio;
    },
    crear: async (datos) => {
      const nuevo: Servicio = {
        id: servicios.length + 1,
        ...datos,
        precio: datos.precio === null ? null : new Decimal(datos.precio),
        activo: true,
        // El alta del catálogo no publica contenido de la landing: lo hace HU-08.
        categoria: null,
        fotoUrl: null,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      };
      servicios.push(nuevo);
      return nuevo;
    },
  };
}

const servicioBase: Servicio = {
  id: 1,
  nombre: 'Coffee break estándar',
  descripcion: 'Café, té, agua, jugo y dos tipos de masas dulces/saladas',
  unidadMedida: 'persona',
  precio: new Decimal('4500'),
  porPersona: true,
  tercerizado: false,
  activo: true,
  categoria: 'Coffee breaks',
  fotoUrl: null,
  creadoEn: new Date(),
  actualizadoEn: new Date(),
};

describe('servicios.servicio: listarServicios', () => {
  it('devuelve solo los servicios activos', async () => {
    const repo = repositorioFake([servicioBase, { ...servicioBase, id: 2, activo: false }]);

    const resultado = await listarServicios(repo);

    expect(resultado).toEqual([servicioBase]);
  });
});

describe('servicios.servicio: crearServicio', () => {
  it('con un nombre nuevo crea el servicio', async () => {
    const repo = repositorioFake([]);

    const creado = await crearServicio(
      {
        nombre: 'Coffee break estándar',
        descripcion: 'Café, té, agua, jugo y dos tipos de masas dulces/saladas',
        unidadMedida: 'persona',
        precio: '4500',
        porPersona: true,
        tercerizado: false,
      },
      repo,
    );

    expect(creado.nombre).toBe('Coffee break estándar');
    expect(creado.activo).toBe(true);
  });

  it('con un nombre ya existente lanza 409 CONFLICT (criterio 4)', async () => {
    const repo = repositorioFake([servicioBase]);

    await expect(
      crearServicio(
        {
          nombre: servicioBase.nombre,
          descripcion: 'Otra descripción',
          unidadMedida: 'persona',
          precio: '5000',
          porPersona: true,
          tercerizado: false,
        },
        repo,
      ),
    ).rejects.toMatchObject({ status: 409, codigo: 'CONFLICT' });
  });
});
