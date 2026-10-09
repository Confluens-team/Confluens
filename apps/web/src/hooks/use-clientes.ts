import type { AsignarEtiqueta, ClienteConResumen, RespuestaExito } from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Listado de clientes del panel del administrador, con su cantidad de eventos y solicitudes.
export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<ClienteConResumen[]>>('/clientes');
      return respuesta.data;
    },
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
