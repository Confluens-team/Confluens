import type {
  AgendarEvento,
  EventoAgenda,
  EventoDetallado,
  FiltrosAgenda,
  RespuestaExito,
} from '@confluens/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Agenda del personal interno (HU-15). Sin filtros la API devuelve los eventos que ocupan el salón
// (Reservado y Cobrado): los Cancelado solo aparecen si se piden. `salonId` y `estado` viajan como
// una lista separada por coma. Mientras llega la respuesta del mes nuevo se sigue mostrando la
// anterior, para que el calendario no quede en blanco al pasar de mes.
// `activa` en false evita el pedido sin rango que, si no, saldría en el primer render del
// calendario —antes de que él avise qué mes quedó visible— y traería la agenda entera.
export function useAgenda(filtros: FiltrosAgenda = {}, activa = true) {
  return useQuery({
    enabled: activa,
    queryKey: ['eventos', 'agenda', filtros],
    queryFn: async () => {
      const parametros = new URLSearchParams();
      if (filtros.desde) parametros.set('desde', filtros.desde);
      if (filtros.hasta) parametros.set('hasta', filtros.hasta);
      if (filtros.salonId?.length) parametros.set('salonId', filtros.salonId.join(','));
      if (filtros.estado?.length) parametros.set('estado', filtros.estado.join(','));
      const consulta = parametros.size > 0 ? `?${parametros}` : '';
      const respuesta = await apiFetch<RespuestaExito<EventoAgenda[]>>(`/eventos${consulta}`);
      return respuesta.data;
    },
    placeholderData: keepPreviousData,
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
      // Reservar o cancelar cambia el estado del presupuesto (HU-10).
      void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
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
      // Reservar o cancelar cambia el estado del presupuesto (HU-10).
      void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
    },
  });
}
