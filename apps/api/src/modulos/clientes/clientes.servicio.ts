import type {
  AsignarEtiqueta,
  FiltrosClientes,
  FiltrosHistorialCliente,
  HistorialCliente,
  ModificarCliente,
} from '@confluens/shared';

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

/**
 * HU-18: el historial de eventos de un cliente, filtrado, más el resumen por estado de todos sus
 * eventos. Una consulta social sin salón viene con `salones` vacío; la web la muestra como «Sin
 * salón asignado». El total es el del presupuesto, sin IVA (RN-05).
 */
export async function obtenerHistorialDeCliente(
  clienteId: number,
  filtros: FiltrosHistorialCliente,
  repo: ClientesRepositorio = clientesRepositorioReal,
): Promise<HistorialCliente> {
  if (!(await repo.existeCliente(clienteId))) {
    throw ErrorApi.noEncontrado('No existe el cliente');
  }
  const [eventos, conteos] = await Promise.all([
    repo.listarEventosDeCliente(clienteId, filtros),
    repo.contarEventosPorEstado(clienteId),
  ]);

  const resumen: HistorialCliente['resumen'] = {
    EnConsulta: 0,
    Reservado: 0,
    Cobrado: 0,
    Cancelado: 0,
  };
  for (const { estado, _count } of conteos) resumen[estado] = _count._all;

  return {
    eventos: eventos.map(({ salones, presupuestos, ...evento }) => ({
      id: evento.id,
      fecha: evento.fecha.toISOString().slice(0, 10),
      inicio: evento.inicio?.toISOString() ?? null,
      fin: evento.fin?.toISOString() ?? null,
      estado: evento.estado,
      tipo: evento.tipo,
      tipoSocial: evento.tipoSocial,
      tipoSocialDetalle: evento.tipoSocialDetalle,
      cantidadPersonas: evento.cantidadPersonas,
      salones: salones.map(({ salon }) => salon),
      presupuestoId: presupuestos[0]?.id ?? null,
      total: presupuestos[0]?.total.toFixed(2) ?? null,
    })),
    resumen,
  };
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

/**
 * HU-17: el personal corrige nombre, apellido y teléfono de cualquier cliente. El correo solo si el
 * cliente no tiene cuenta: en uno con cuenta es su usuario para iniciar sesión y lo cambia él
 * (decisión del PO, 16/10/2026). Mandar el mismo correo que ya tiene no cuenta como un cambio, así
 * la web puede enviar el formulario entero. Un correo de otro cliente se rechaza con 409.
 */
export async function modificarCliente(
  clienteId: number,
  datos: ModificarCliente,
  repo: ClientesRepositorio = clientesRepositorioReal,
) {
  const actual = await repo.buscarConResumen(clienteId);
  if (!actual) throw ErrorApi.noEncontrado('No existe el cliente');

  const nuevoCorreo = datos.correo;
  const cambiaElCorreo = nuevoCorreo !== undefined && nuevoCorreo !== actual.correo.toLowerCase();
  if (cambiaElCorreo) {
    if (actual.usuarioId !== null) {
      throw ErrorApi.reglaNegocio(
        'El correo de un cliente con cuenta es su usuario para iniciar sesión: lo cambia él desde su cuenta',
        [{ campo: 'correo', mensaje: 'El cliente tiene cuenta, no se puede cambiar su correo' }],
      );
    }
    if (await repo.existeOtroClienteConCorreo(nuevoCorreo, clienteId)) {
      throw ErrorApi.conflicto('Ese correo ya pertenece a otro cliente');
    }
  }

  const correo = cambiaElCorreo ? nuevoCorreo : undefined;
  return conResumen(await repo.modificarDatos(clienteId, { ...datos, correo }));
}
