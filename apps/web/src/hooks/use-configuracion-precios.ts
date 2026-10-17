import type {
  ActualizarConfiguracionPrecios,
  ConfiguracionPrecios,
  RespuestaExito,
} from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// RN-13: el porcentaje de incremento mensual con el que el cotizador y el editor del presupuesto
// proyectan los precios a la fecha del evento, igual que la API.
export function useConfiguracionPrecios() {
  return useQuery({
    queryKey: ['configuracion-precios'],
    queryFn: async () => {
      const respuesta =
        await apiFetch<RespuestaExito<ConfiguracionPrecios>>('/configuracion-precios');
      return respuesta.data;
    },
  });
}

export function useGuardarConfiguracionPrecios() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: ActualizarConfiguracionPrecios) => {
      const respuesta = await apiFetch<RespuestaExito<ConfiguracionPrecios>>(
        '/configuracion-precios',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        },
      );
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['configuracion-precios'] });
    },
  });
}
