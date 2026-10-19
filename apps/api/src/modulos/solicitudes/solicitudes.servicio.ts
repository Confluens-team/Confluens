import type { CrearSolicitud } from '@confluens/shared';

import { ErrorApi } from '../../lib/errores.js';
import * as solicitudesRepositorioReal from './solicitudes.repositorio.js';
import type { SolicitudesRepositorio } from './solicitudes.repositorio.js';

// Sin lógica de negocio en el listado (mismo criterio que salones.servicio.ts / servicios.servicio.ts):
// es una consulta simple, HU-14 no define ningún filtro u orden con reglas RN-xx.
export async function listarSolicitudes(repo: SolicitudesRepositorio = solicitudesRepositorioReal) {
  return repo.listar();
}

/**
 * Registra una solicitud del canal público (HU-14).
 *
 * No hay reglas de negocio propias más allá de la validación de datos obligatorios, que ya
 * resuelve esquemaCrearSolicitud en la ruta (criterio 5). Por eso este servicio es un paso
 * intermedio fino: existe para mantener la capa (controlador no toca el repositorio directo,
 * ver convenciones.md) y para el día que HU-15/futuras reglas necesiten interceptar el alta
 * (por ejemplo, para crear el evento EnConsulta al "tomar" la solicitud).
 *
 * `usuarioCliente` es el id de usuario de la sesión cuando consulta un CLIENTE: la solicitud queda
 * asociada a su ficha (M1 de la auditoría de seguridad). Así se sabe quién la creó y solo él puede
 * vincularla después a su consulta (A2, ver presupuestos.servicio.ts).
 */
export async function registrarSolicitud(
  datos: CrearSolicitud,
  repo: SolicitudesRepositorio = solicitudesRepositorioReal,
  usuarioCliente?: number,
) {
  if (usuarioCliente === undefined) return repo.crear(datos);

  const cliente = await repo.buscarClientePorUsuarioId(usuarioCliente);
  if (!cliente) throw ErrorApi.noEncontrado('La sesión no corresponde a un cliente');
  return repo.crear(datos, cliente.id);
}
