import type {
  AgendarEvento,
  EventoAgenda,
  EventoDetallado,
  RespuestaExito,
} from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Agenda del panel del administrador: eventos Reservado y Cobrado, ordenados por fecha.
export function useAgenda() {
  return useQuery({
    queryKey: ['eventos', 'agenda'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<EventoAgenda[]>>('/eventos');
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

// Fija distribución, horario y modalidad del evento. NO lo reserva: el evento sigue EnConsulta
// hasta que un pago cruce el 20% de la base de cobro (HU-13).
export function useAgendarEvento(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: AgendarEvento) => {
      const respuesta = await apiFetch<RespuestaExito<EventoDetallado>>(`/eventos/${id}/agendar`, {
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

// RN-07: solo se admite hasta 48 horas antes del inicio. Siempre manual (dominio.md).
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
