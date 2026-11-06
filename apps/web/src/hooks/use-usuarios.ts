import type { RegistrarUsuario, RespuestaExito, Usuario } from '@confluens/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// HU-30 del Sprint 4: alta de un usuario del personal con su rol y su contraseña inicial.
export function useRegistrarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: RegistrarUsuario) => {
      const respuesta = await apiFetch<RespuestaExito<Usuario>>('/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}
