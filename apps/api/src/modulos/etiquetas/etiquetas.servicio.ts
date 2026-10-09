import type { CrearEtiqueta, Etiqueta } from '@confluens/shared';

import { ErrorApi } from '../../lib/errores.js';
import * as etiquetasRepositorioReal from './etiquetas.repositorio.js';
import type { EtiquetasRepositorio } from './etiquetas.repositorio.js';

export async function listarEtiquetas(
  repo: EtiquetasRepositorio = etiquetasRepositorioReal,
): Promise<Etiqueta[]> {
  return repo.listar();
}

// El nombre llega recortado por esquemaCrearEtiqueta. Es único sin distinguir mayúsculas: si ya
// existe, la web tenía que asignar esa en lugar de crear otra.
export async function crearEtiqueta(
  datos: CrearEtiqueta,
  repo: EtiquetasRepositorio = etiquetasRepositorioReal,
): Promise<Etiqueta> {
  const existente = await repo.buscarPorNombre(datos.nombre);
  if (existente) {
    throw ErrorApi.conflicto('Ya existe una etiqueta con ese nombre');
  }
  return repo.crear(datos.nombre);
}
