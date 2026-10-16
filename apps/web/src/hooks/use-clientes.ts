import type {
  AsignarEtiqueta,
  ClienteConResumen,
  FiltrosClientes,
  FiltrosHistorialCliente,
  HistorialCliente,
  RespuestaExito,
} from '@confluens/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

/**
 * HU-16: listado de clientes del panel, con su cantidad de eventos y solicitudes. La búsqueda la
 * resuelve la API; mientras llega la respuesta de una búsqueda nueva se sigue mostrando la anterior
 * para que la tabla no parpadee con cada tecla.
 */
export function useClientes(filtros: FiltrosClientes = {}) {
  return useQuery({
    queryKey: ['clientes', filtros],
    queryFn: async () => {
      const parametros = new URLSearchParams();
      if (filtros.busqueda) parametros.set('busqueda', filtros.busqueda);
      const consulta = parametros.size ? `?${parametros}` : '';
      const respuesta = await apiFetch<RespuestaExito<ClienteConResumen[]>>(`/clientes${consulta}`);
      return respuesta.data;
    },
    placeholderData: keepPreviousData,
  });
}

// HU-16 C4: la ficha de un cliente.
export function useCliente(id: number) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<ClienteConResumen>>(`/clientes/${id}`);
      return respuesta.data;
    },
  });
}

/**
 * HU-18: el historial de eventos de un cliente y su resumen por estado. La clave empieza con
 * 'eventos' para que se refresque sola cuando un pago, una cancelación o una modificación
 * invalidan los eventos (use-eventos.ts, use-pagos.ts).
 */
export function useHistorialCliente(clienteId: number, filtros: FiltrosHistorialCliente = {}) {
  return useQuery({
    queryKey: ['eventos', 'cliente', clienteId, filtros],
    queryFn: async () => {
      const parametros = new URLSearchParams();
      if (filtros.estado?.length) parametros.set('estado', filtros.estado.join(','));
      if (filtros.desde) parametros.set('desde', filtros.desde);
      if (filtros.hasta) parametros.set('hasta', filtros.hasta);
      const consulta = parametros.size ? `?${parametros}` : '';
      const respuesta = await apiFetch<RespuestaExito<HistorialCliente>>(
        `/clientes/${clienteId}/eventos${consulta}`,
      );
      return respuesta.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Le pone o le quita (etiquetaId null) la etiqueta a un cliente. La etiqueta se muestra también en
 * Consultas y en la agenda, así que se invalidan esas listas además de la de clientes.
 */
export function useAsignarEtiqueta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clienteId, ...datos }: AsignarEtiqueta & { clienteId: number }) => {
      const respuesta = await apiFetch<RespuestaExito<ClienteConResumen>>(
        `/clientes/${clienteId}/etiqueta`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        },
      );
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clientes'] });
      void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
      void queryClient.invalidateQueries({ queryKey: ['eventos'] });
    },
  });
}
