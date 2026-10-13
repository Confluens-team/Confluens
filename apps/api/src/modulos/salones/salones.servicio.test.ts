import { describe, expect, it, vi } from 'vitest';

import { actualizarLandingSalon } from './salones.servicio.js';

// ADR 0009: al cambiar la foto de un salón, la anterior se borra de Cloudinary después de guardar.
const fotoVieja = 'https://res.cloudinary.com/demo/image/upload/v1/confluens/salones/vieja.jpg';
const fotoNueva = 'https://res.cloudinary.com/demo/image/upload/v2/confluens/salones/nueva.jpg';

function repoFake(salon: { visibleEnLanding: boolean; fotoUrl: string | null } | null) {
  return {
    obtenerSalonPorId: vi.fn(async () => (salon ? { id: 1, nombre: 'Pucará', ...salon } : null)),
    actualizarLanding: vi.fn(async (_id: number, cambios: object) => ({ id: 1, ...cambios })),
  } as never;
}

describe('salones.servicio: actualizarLandingSalon', () => {
  it('guarda el cambio y pide borrar la foto anterior con la nueva', async () => {
    const repo = repoFake({ visibleEnLanding: true, fotoUrl: fotoVieja });
    const borrarFotoReemplazada = vi.fn(async () => {});

    await actualizarLandingSalon(1, { fotoUrl: fotoNueva }, 7, repo, { borrarFotoReemplazada });

    expect(borrarFotoReemplazada).toHaveBeenCalledWith(fotoVieja, fotoNueva);
  });

  it('si solo cambia la visibilidad, le pasa la foto sin tocar (undefined): no se borra nada', async () => {
    const repo = repoFake({ visibleEnLanding: true, fotoUrl: fotoVieja });
    const borrarFotoReemplazada = vi.fn(async () => {});

    await actualizarLandingSalon(1, { visibleEnLanding: false }, 7, repo, {
      borrarFotoReemplazada,
    });

    expect(borrarFotoReemplazada).toHaveBeenCalledWith(fotoVieja, undefined);
  });

  it('con un salón inexistente lanza 404 sin tocar Cloudinary', async () => {
    const borrarFotoReemplazada = vi.fn(async () => {});

    await expect(
      actualizarLandingSalon(99, { fotoUrl: fotoNueva }, 7, repoFake(null), {
        borrarFotoReemplazada,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(borrarFotoReemplazada).not.toHaveBeenCalled();
  });
});
