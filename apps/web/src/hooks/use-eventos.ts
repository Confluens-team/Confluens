import type {
  EventoAgenda,
  EventoDetallado,
  ReservarEvento,
  RespuestaExito,
} from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Eventos del panel del administrador, ordenados por fecha. Sin estado es la agenda (Reservado y
// Cobrado); con 'EnConsulta', los que todavía se están cotizando.
export function useAgenda(estado?: 'EnConsulta') {
  return useQuery({
    queryKey: ['eventos', 'listado', estado ?? 'agenda'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<EventoAgenda[]>>(
        estado ? `/eventos?estado=${estado}` : '/eventos',
      );
      return respuesta.data;
    },
  });
}

// Usado por DetalleEvento.tsx (HU-15): el detalle completo del evento, con cliente, salón,
// distribución, la solicitud original (si vino de una) y el/los presupuesto(s) con sus líneas.
export function useEvento(id: number) {
  return useQuery({
    queryKey: ['eventos', id],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<EventoDetallado>>(`/eventos/${id}`);
      return respuesta.data;
    },
  });
}

// Confirma el presupuesto Estimado y reserva el salón en un solo paso (criterios 1-3 y 7).
export function useReservarEvento(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: ReservarEvento) => {
      const respuesta = await apiFetch<RespuestaExito<EventoDetallado>>(`/eventos/${id}/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      return respuesta.data;
    },
    onSuccess: () => {
      // ['eventos'] alcanza al detalle y a la agenda del administrador, que cambia con el estado.
      void queryClient.invalidateQueries({ queryKey: ['eventos'] });
    },
  });
}

// RN-06: el RE marca la seña como cobrada.
export function useRegistrarSena(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<EventoDetallado>>(
        `/eventos/${id}/registrar-sena`,
        { method: 'POST' },
      );
      return respuesta.data;
    },
    onSuccess: () => {
      // ['eventos'] alcanza al detalle y a la agenda del administrador, que cambia con el estado.
      void queryClient.invalidateQueries({ queryKey: ['eventos'] });
    },
  });
}

// Criterio 5 / RN-07: solo se admite hasta 48 horas antes del inicio.
export function useCancelarEvento(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<EventoDetallado>>(`/eventos/${id}/cancelar`, {
        method: 'POST',
      });
      return respuesta.data;
    },
    onSuccess: () => {
      // ['eventos'] alcanza al detalle y a la agenda del administrador, que cambia con el estado.
      void queryClient.invalidateQueries({ queryKey: ['eventos'] });
    },
  });
}
