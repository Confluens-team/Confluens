import type {
  ActualizarLandingSalon,
  RespuestaExito,
  Salon,
  SalonConDistribuciones,
  SalonPublico,
} from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Los 5 salones con distribuciones anidadas llegan en un único request (ver comentario en
// packages/shared/src/esquemas/salon.esquema.ts); no hace falta paginar ni refetch agresivo
// porque el catálogo cambia por seed o alta manual, no en tiempo real.
export function useSalones() {
  return useQuery({
    queryKey: ['salones'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<SalonConDistribuciones[]>>('/salones');
      return respuesta.data;
    },
  });
}

// Catálogo del canal público (HU-07). Query aparte de useSalones —y no el mismo dato filtrado en
// la web— porque son respuestas distintas: esta no trae los salones despublicados ni los precios.
// La clave anidada ['salones', 'publicos'] hace que invalidateQueries({ queryKey: ['salones'] })
// alcance a las dos, que es lo que el criterio 4 pide: si cambian los datos de un salón, la landing
// se actualiza sin un paso de publicación manual.
export function useSalonesPublicos() {
  return useQuery({
    queryKey: ['salones', 'publicos'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<SalonPublico[]>>('/salones/publicos');
      return respuesta.data;
    },
  });
}

// HU-08: publicar/despublicar un salón y asignarle la foto. Invalidar ['salones'] alcanza también
// a ['salones', 'publicos'] por la clave anidada, así que el cambio se ve en la landing sin ningún
// paso de publicación extra (criterio 3). Eso es lo único que hace falta para cumplirlo: la landing
// lee siempre de la base, no hay una copia publicada aparte que sincronizar.
export function useActualizarLandingSalon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cambios }: { id: number; cambios: ActualizarLandingSalon }) => {
      const respuesta = await apiFetch<RespuestaExito<Salon>>(`/salones/${id}/landing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['salones'] });
    },
  });
}
