import * as clientesRepositorioReal from './clientes.repositorio.js';
import type { ClientesRepositorio } from './clientes.repositorio.js';

// Aplana el _count de Prisma en los dos contadores de esquemaClienteConResumen.
export async function listarClientes(repo: ClientesRepositorio = clientesRepositorioReal) {
  const clientes = await repo.listarConResumen();
  return clientes.map(({ _count, ...cliente }) => ({
    ...cliente,
    cantidadEventos: _count.eventos,
    cantidadSolicitudes: _count.solicitudes,
  }));
}
