import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ModuloActividad from './actividad.js';

// src/test/preparar.ts reemplaza este módulo para los tests de rutas: acá va el real.
const { anotarActividad, olvidarActividad } =
  await vi.importActual<typeof ModuloActividad>('./actividad.js');

// Estado de conexión del personal: la marca de última actividad se anota a lo sumo una vez por minuto
// por usuario, sin esperar a la base y sin hacer fallar el pedido.
describe('anotarActividad', () => {
  const ahora = 1_800_000_000_000;
  let escribir: ReturnType<typeof vi.fn<(usuarioId: number) => Promise<void>>>;

  beforeEach(() => {
    escribir = vi.fn<(usuarioId: number) => Promise<void>>().mockResolvedValue();
    // La marca en memoria es de módulo: cada test arranca sin la de los usuarios que usa.
    for (const id of [1, 2, 3]) olvidarActividad(id);
  });

  it('el primer pedido anota, y los de los siguientes 59 segundos no', () => {
    anotarActividad(1, ahora, escribir);
    anotarActividad(1, ahora + 10_000, escribir);
    anotarActividad(1, ahora + 59_999, escribir);

    expect(escribir).toHaveBeenCalledTimes(1);
    expect(escribir).toHaveBeenCalledWith(1);
  });

  it('pasado el minuto vuelve a anotar', () => {
    anotarActividad(1, ahora, escribir);
    anotarActividad(1, ahora + 60_000, escribir);

    expect(escribir).toHaveBeenCalledTimes(2);
  });

  it('cada usuario tiene su propio tope', () => {
    anotarActividad(1, ahora, escribir);
    anotarActividad(2, ahora + 1_000, escribir);

    expect(escribir).toHaveBeenCalledTimes(2);
  });

  it('al cerrar sesión el próximo pedido anota enseguida, sin esperar el minuto', () => {
    anotarActividad(1, ahora, escribir);
    olvidarActividad(1);
    anotarActividad(1, ahora + 1_000, escribir);

    expect(escribir).toHaveBeenCalledTimes(2);
  });

  it('si la escritura falla no tira el pedido y el siguiente puede reintentar', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    escribir.mockRejectedValueOnce(new Error('base caída'));

    expect(() => anotarActividad(3, ahora, escribir)).not.toThrow();
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    anotarActividad(3, ahora + 1_000, escribir);

    expect(escribir).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('no espera a la base: devuelve antes de que la escritura termine', () => {
    let terminar: () => void = () => undefined;
    escribir.mockReturnValueOnce(new Promise<void>((resolver) => (terminar = resolver)));

    const resultado = anotarActividad(2, ahora, escribir);

    expect(resultado).toBeUndefined();
    terminar();
  });
});
