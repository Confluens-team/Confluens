import type {
  Credenciales,
  PerfilCliente,
  RegistroCliente,
  RespuestaExito,
  Sesion,
} from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, ErrorApiCliente } from '@/lib/api';

const CLAVE_SESION = ['sesion'] as const;

/**
 * Sesión actual, si existe. `retry: false` es clave acá: un 401 de GET /auth/yo es
 * una respuesta legítima (no hay sesión iniciada), no un error transitorio de red.
 * Sin esto, TanStack Query reintentaría varias veces antes de resolver "sin
 * sesión", demorando la pantalla de login innecesariamente.
 */
export function useSesion() {
  return useQuery<Sesion | null>({
    queryKey: CLAVE_SESION,
    queryFn: async () => {
      try {
        const respuesta = await apiFetch<RespuestaExito<Sesion>>('/auth/yo');
        return respuesta.data;
      } catch (error) {
        if (error instanceof ErrorApiCliente && error.code === 'UNAUTHENTICATED') {
          return null;
        }
        throw error;
      }
    },
    retry: false,
  });
}

export function useIniciarSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credenciales: Credenciales) => {
      const respuesta = await apiFetch<RespuestaExito<Sesion>>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credenciales),
      });
      return respuesta.data;
    },
    onSuccess: (sesion) => {
      // Escribe directo en cache en vez de solo invalidar: evita un GET /auth/yo
      // extra inmediatamente después del login, ya que login ya devuelve la sesión.
      queryClient.setQueryData(CLAVE_SESION, sesion);
    },
  });
}

export function useCerrarSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(CLAVE_SESION, null);
      queryClient.removeQueries({ queryKey: ['perfil-cliente'] });
    },
  });
}

// Alta de cuenta del Cliente desde la landing. Igual que el login, la API ya deja la cookie
// seteada y devuelve la sesión, así que se escribe directo en cache.
export function useRegistrarCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: RegistroCliente) => {
      const respuesta = await apiFetch<RespuestaExito<Sesion>>('/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      return respuesta.data;
    },
    onSuccess: (sesion) => {
      queryClient.setQueryData(CLAVE_SESION, sesion);
    },
  });
}

// Datos comerciales del Cliente de la sesión (nombre y teléfono), que el cotizador necesita para
// armar el presupuesto. Solo se pide con una sesión de CLIENTE: para el personal la API responde 403.
export function usePerfilCliente(habilitado: boolean) {
  return useQuery({
    queryKey: ['perfil-cliente'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<PerfilCliente>>('/auth/perfil');
      return respuesta.data;
    },
    enabled: habilitado,
  });
}
