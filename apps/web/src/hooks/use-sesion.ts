import type {
  Credenciales,
  PerfilCliente,
  RegistroCliente,
  RespuestaExito,
  RestablecerContrasena,
  Sesion,
  SolicitarRestablecimiento,
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
      // Todo lo demás se pidió con la sesión (precios, perfil, datos del panel): se descarta para
      // que no quede en memoria después de salir (C5 de HU-48). Lo público se vuelve a pedir.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== CLAVE_SESION[0] });
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

// Olvidé mi contraseña (C8 de HU-48), para clientes y personal. La API responde 204 exista o no
// la cuenta, así que la pantalla muestra siempre el mismo mensaje.
export function useSolicitarRestablecimiento() {
  return useMutation({
    mutationFn: (datos: SolicitarRestablecimiento) =>
      apiFetch<void>('/auth/contrasena/olvido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      }),
  });
}

// Con el token del enlace del correo. Como el login, la API deja la sesión iniciada.
export function useRestablecerContrasena() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: RestablecerContrasena) => {
      const respuesta = await apiFetch<RespuestaExito<Sesion>>('/auth/contrasena/restablecer', {
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
