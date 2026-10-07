import type { CrearServicio } from '@confluens/shared';

import { ErrorApi } from '../../lib/errores.js';
import * as serviciosRepositorioReal from './servicios.repositorio.js';
import type { ServiciosRepositorio } from './servicios.repositorio.js';

// Sin lógica de negocio en el listado (mismo criterio que salones.servicio.ts en HU-01): es un
// catálogo de consulta, no hay reglas RN-xx sobre qué se lista.
export async function listarServicios(repo: ServiciosRepositorio = serviciosRepositorioReal) {
  return repo.listarActivos();
}

// Catálogo del canal público (HU-07). El recorte de campos vive en el repositorio: es parte de la
// consulta, no una regla que dependa de quién pregunta (ver salones.servicio.ts).
export async function listarServiciosPublicos(
  repo: ServiciosRepositorio = serviciosRepositorioReal,
) {
  return repo.listarPublicos();
}

/**
 * Crea un servicio nuevo en el catálogo.
 *
 * Criterio 4 (sprint-01.md / HU-32): el nombre del servicio identifica el ítem del catálogo, así
 * que se rechaza el alta con 409 CONFLICT si ya existe uno con el mismo nombre — evita duplicados
 * accidentales al cargar el tarifario (ver docs/negocio/tarifario-2026.md).
 *
 * `repo` tiene un default para uso real; en los tests unitarios se pasa un fake para no tocar
 * Prisma/la base de datos (ver servicios.servicio.test.ts), mismo criterio que auth.servicio.ts.
 */
export async function crearServicio(
  datos: CrearServicio,
  repo: ServiciosRepositorio = serviciosRepositorioReal,
) {
  const existente = await repo.buscarPorNombre(datos.nombre);
  if (existente) {
    throw ErrorApi.conflicto(`Ya existe un servicio con el nombre "${datos.nombre}"`);
  }

  return repo.crear(datos);
}

// HU-08: asigna (o quita, con null) la foto del servicio en la landing. Igual que en salones, se
// lee el estado anterior para poder auditarlo y se corta con 404 antes de escribir.
export async function actualizarLandingServicio(
  id: number,
  fotoUrl: string | null,
  usuarioId: number,
  repo: ServiciosRepositorio = serviciosRepositorioReal,
) {
  const servicio = await repo.buscarPorId(id);
  if (!servicio) throw ErrorApi.noEncontrado('No existe el servicio indicado');

  return repo.actualizarLanding(id, fotoUrl, servicio.fotoUrl, usuarioId);
}
