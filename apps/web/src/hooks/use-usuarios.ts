import type { RegistrarUsuario, RespuestaExito, RolPersonal, Usuario } from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// HU-31 del Sprint 4: los usuarios del personal, por rol y después por correo. El filtro por rol lo
// resuelve la API.
export function useUsuarios(rol?: RolPersonal) {
  return useQuery({
    queryKey: ['usuarios', rol ?? 'todos'],
    queryFn: async () => {
      const consulta = rol ? `?rol=${rol}` : '';
      const respuesta = await apiFetch<RespuestaExito<Usuario[]>>(`/usuarios${consulta}`);
      return respuesta.data;
    },
  });
}

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
