import type {
  CrearPago,
  CuentaEvento,
  MedioPago,
  RespuestaExito,
  ResultadoPago,
} from '@confluens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// HU-14 C2: historial de pagos del evento más su saldo, recalculado en cada consulta sobre la base
// de cobro de RN-01 (nunca se guarda, sprint-02.md:130).
export function usePagosDeEvento(eventoId: number) {
  return useQuery({
    queryKey: ['eventos', eventoId, 'pagos'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<CuentaEvento>>(`/eventos/${eventoId}/pagos`);
      return respuesta.data;
    },
  });
}

/**
 * HU-14 + HU-13: registra una entrega de plata contra el evento. Puede cambiarle el estado como
 * efecto, no como pedido aparte: al cruzar el 20% de la base de cobro confirma el presupuesto y
 * reserva el salón, y al 100% lo pasa a Cobrado. Por eso invalida `['eventos']` entero (detalle y
 * agenda del administrador), no solo la cuenta.
 */
export function useRegistrarPago(eventoId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: CrearPago) => {
      const respuesta = await apiFetch<RespuestaExito<ResultadoPago>>(
        `/eventos/${eventoId}/pagos`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        },
      );
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['eventos'] });
    },
  });
}

// Medios activos para poblar el <select> del formulario de cobro. El ABM es del Sprint 3 (HU-36 a
// HU-39): acá solo se leen. Catálogo chico y estable, así que no se refetchea al volver a la vista.
export function useMediosPago() {
  return useQuery({
    queryKey: ['medios-pago'],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<MedioPago[]>>('/medios-pago');
      return respuesta.data;
    },
    staleTime: Infinity,
  });
}
