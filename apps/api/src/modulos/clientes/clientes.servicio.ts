import type { AsignarEtiqueta } from '@confluens/shared';

import { ErrorApi } from '../../lib/errores.js';
import * as clientesRepositorioReal from './clientes.repositorio.js';
import type { ClientesRepositorio } from './clientes.repositorio.js';

type ClienteConConteo = Awaited<ReturnType<ClientesRepositorio['listarConResumen']>>[number];

// Aplana el _count de Prisma en los dos contadores de esquemaClienteConResumen.
function conResumen({ _count, ...cliente }: ClienteConConteo) {
  return {
    ...cliente,
    cantidadEventos: _count.eventos,
    cantidadSolicitudes: _count.solicitudes,
  };
}

export async function listarClientes(repo: ClientesRepositorio = clientesRepositorioReal) {
  const clientes = await repo.listarConResumen();
  return clientes.map(conResumen);
}

// Le pone o le quita (etiquetaId null) la etiqueta a un cliente. Solo el personal (dominio.md).
export async function asignarEtiquetaACliente(
  clienteId: number,
  { etiquetaId }: AsignarEtiqueta,
  repo: ClientesRepositorio = clientesRepositorioReal,
) {
  if (!(await repo.existeCliente(clienteId))) {
    throw ErrorApi.noEncontrado('No existe el cliente');
  }
  if (etiquetaId !== null && !(await repo.existeEtiqueta(etiquetaId))) {
    throw ErrorApi.noEncontrado('No existe la etiqueta');
  }
  return conResumen(await repo.asignarEtiqueta(clienteId, etiquetaId));
}
