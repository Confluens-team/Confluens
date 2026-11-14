import type {
  ModificarUsuario,
  RegistrarUsuario,
  RespuestaExito,
  RolPersonal,
  Usuario,
} from '@confluens/shared';
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

// HU-30 del backlog: el correo y el rol de un usuario del personal.
export function useModificarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, datos }: { id: number; datos: ModificarUsuario }) => {
      const respuesta = await apiFetch<RespuestaExito<Usuario>>(`/usuarios/${id}`, {
        method: 'PATCH',
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

// HU-31 del backlog: baja lógica (`activo: false`) o reactivación.
export function useCambiarEstadoUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, activo }: { id: number; activo: boolean }) => {
      const respuesta = await apiFetch<RespuestaExito<Usuario>>(`/usuarios/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

// HU-30 del backlog: el ADM le carga una contraseña nueva a otro usuario.
export function useCambiarContrasenaUsuario() {
  return useMutation({
    mutationFn: async ({ id, contrasena }: { id: number; contrasena: string }) => {
      await apiFetch<void>(`/usuarios/${id}/contrasena`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contrasena }),
      });
    },
  });
}
