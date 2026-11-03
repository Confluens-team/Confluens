import { describe, expect, it, vi } from 'vitest';

import type { Servicio } from '../../generated/prisma/client.js';
import { Decimal } from '../../generated/prisma/internal/prismaNamespace.js';
import type { ServiciosRepositorio } from './servicios.repositorio.js';
import {
  actualizarLandingServicio,
  crearServicio,
  listarServicios,
  modificarServicio,
} from './servicios.servicio.js';

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
    buscarPorNombre: async (nombre) =>
      servicios.find((s) => s.nombre.toLowerCase() === nombre.toLowerCase()) ?? null,
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
    modificar: async (id, datos) => {
      const servicio = servicios.find((s) => s.id === id)!;
      Object.assign(servicio, {
        ...datos,
        precio: datos.precio === null ? null : new Decimal(datos.precio),
      });
      return servicio;
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
  admiteModalidad: false,
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
        admiteModalidad: false,
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
          admiteModalidad: false,
        },
        repo,
      ),
    ).rejects.toMatchObject({ status: 409, codigo: 'CONFLICT' });
  });

  it('con un nombre existente escrito con otras mayúsculas también lanza 409', async () => {
    const repo = repositorioFake([servicioBase]);

    await expect(
      crearServicio(
        {
          nombre: 'COFFEE BREAK ESTÁNDAR',
          descripcion: 'Otra descripción',
          unidadMedida: 'persona',
          precio: '5000',
          porPersona: true,
          tercerizado: false,
          admiteModalidad: false,
        },
        repo,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('servicios.servicio: actualizarLandingServicio (ADR 0009)', () => {
  const fotoVieja = 'https://res.cloudinary.com/demo/image/upload/v1/confluens/servicios/vieja.jpg';
  const fotoNueva = 'https://res.cloudinary.com/demo/image/upload/v2/confluens/servicios/nueva.jpg';

  it('guarda la foto nueva y después pide borrar la anterior', async () => {
    const repo = repositorioFake([{ ...servicioBase, fotoUrl: fotoVieja }]);
    const borrarFotoReemplazada = vi.fn(async () => {});

    const actualizado = await actualizarLandingServicio(1, fotoNueva, 7, repo, {
      borrarFotoReemplazada,
    });

    expect(actualizado.fotoUrl).toBe(fotoNueva);
    expect(borrarFotoReemplazada).toHaveBeenCalledWith(fotoVieja, fotoNueva);
  });

  it('con un servicio inexistente lanza 404 sin tocar Cloudinary', async () => {
    const borrarFotoReemplazada = vi.fn(async () => {});

    await expect(
      actualizarLandingServicio(99, fotoNueva, 7, repositorioFake([]), { borrarFotoReemplazada }),
    ).rejects.toMatchObject({ status: 404 });
    expect(borrarFotoReemplazada).not.toHaveBeenCalled();
  });
});

describe('servicios.servicio: modificarServicio (HU-32 del Sprint 4)', () => {
  const cambios = {
    nombre: 'Coffee break estándar',
    descripcion: 'Café, té y masas',
    unidadMedida: 'persona',
    precio: '5200.00',
    porPersona: true,
    tercerizado: false,
    admiteModalidad: true,
    categoria: 'Coffee breaks',
  };

  it('modifica los datos conservando su propio nombre', async () => {
    const repo = repositorioFake([{ ...servicioBase }]);

    const modificado = await modificarServicio(1, cambios, repo);

    expect(modificado).toMatchObject({ descripcion: 'Café, té y masas', admiteModalidad: true });
    expect(modificado.precio?.toString()).toBe('5200');
  });

  it('con el nombre de otro servicio lanza 409 sin modificar nada', async () => {
    const otro = { ...servicioBase, id: 2, nombre: 'Desayuno americano' };
    const repo = repositorioFake([{ ...servicioBase }, otro]);
    const modificar = vi.spyOn(repo, 'modificar');

    await expect(
      modificarServicio(1, { ...cambios, nombre: 'Desayuno americano' }, repo),
    ).rejects.toMatchObject({ status: 409 });
    expect(modificar).not.toHaveBeenCalled();
  });

  it('el nombre de otro servicio con otras mayúsculas también lanza 409', async () => {
    const otro = { ...servicioBase, id: 2, nombre: 'Desayuno americano' };
    const repo = repositorioFake([{ ...servicioBase }, otro]);

    await expect(
      modificarServicio(1, { ...cambios, nombre: 'DESAYUNO americano' }, repo),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('cambiarle solo las mayúsculas al propio nombre no choca', async () => {
    const repo = repositorioFake([{ ...servicioBase }]);

    const modificado = await modificarServicio(
      1,
      { ...cambios, nombre: 'Coffee Break Estándar' },
      repo,
    );

    expect(modificado.nombre).toBe('Coffee Break Estándar');
  });

  it('con un servicio inexistente lanza 404', async () => {
    await expect(modificarServicio(99, cambios, repositorioFake([]))).rejects.toMatchObject({
      status: 404,
    });
  });
});
