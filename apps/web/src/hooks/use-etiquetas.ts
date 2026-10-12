import type { CrearEtiqueta, Etiqueta, RespuestaExito } from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Etiquetas que el personal le puede asignar a un cliente. Lista chica: alimenta el <datalist> del
// listado de clientes.
export function useEtiquetas() {
  return useQuery({
    queryKey: ['etiquetas'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<Etiqueta[]>>('/etiquetas');
      return respuesta.data;
    },
  });
}

// Se crea al asignarla, cuando el nombre escrito no coincide con ninguna existente.
export function useCrearEtiqueta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: CrearEtiqueta) => {
      const respuesta = await apiFetch<RespuestaExito<Etiqueta>>('/etiquetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['etiquetas'] });
    },
  });
}
