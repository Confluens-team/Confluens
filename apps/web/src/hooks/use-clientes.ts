import type { ClienteConResumen, RespuestaExito } from '@confluens/shared';
import { useQuery } from '@tanstack/react-query';

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
