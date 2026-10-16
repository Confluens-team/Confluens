import type { AsignarEtiqueta, FiltrosClientes } from '@confluens/shared';

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

// HU-16 C3: alfabético por apellido y nombre. Una razón social no tiene apellido, así que se
// ordena por su nombre, intercalada con las personas («Acme» antes que «Bustos, Ana»). Sin
// distinguir mayúsculas ni tildes, como lo leería una persona.
const alfabetico = new Intl.Collator('es', { sensitivity: 'base' });
export function compararClientes(
  a: { nombre: string; apellido: string | null },
  b: { nombre: string; apellido: string | null },
): number {
  return (
    alfabetico.compare(a.apellido ?? a.nombre, b.apellido ?? b.nombre) ||
    alfabetico.compare(a.nombre, b.nombre)
  );
}

export async function listarClientes(
  { busqueda }: FiltrosClientes = {},
  repo: ClientesRepositorio = clientesRepositorioReal,
) {
  const clientes = await repo.listarConResumen(busqueda);
  return clientes.map(conResumen).sort(compararClientes);
}

// La ficha del cliente (HU-16 C4).
export async function obtenerCliente(
  id: number,
  repo: ClientesRepositorio = clientesRepositorioReal,
) {
  const cliente = await repo.buscarConResumen(id);
  if (!cliente) throw ErrorApi.noEncontrado('No existe el cliente');
  return conResumen(cliente);
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
