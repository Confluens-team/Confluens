import type {
  CrearPresupuesto,
  CrearSolicitud,
  PresupuestoDetallado,
  RespuestaExito,
  Solicitud,
} from '@confluens/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Usado por TomarConsulta.tsx (HU-09/HU-15): crea Cliente (si hace falta), Evento EnConsulta y
// Presupuesto Estimado en un solo paso. Si `datos.solicitudId` viene, además vincula
// Solicitud.eventoId (HU-15), por eso invalida también ['solicitudes'].
export function useCrearPresupuesto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: CrearPresupuesto) => {
      const respuesta = await apiFetch<RespuestaExito<PresupuestoDetallado>>('/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
    },
  });
}

// Cotizador del cliente registrado (landing). Registra primero la Solicitud —así la consulta le
// aparece al Responsable de Eventos en su listado, igual que las del formulario público— y después
// genera el Presupuesto Estimado vinculado a ella (mismo solicitudId que usa TomarConsulta, HU-15).
export function useSolicitarPresupuesto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (datos: Omit<CrearPresupuesto, 'solicitudId'>) => {
      const solicitud: CrearSolicitud = {
        nombre: datos.nombre,
        telefono: datos.telefono,
        correo: datos.correo,
        fechaDeseada: datos.fecha,
        cantidadPersonas: datos.cantidadPersonas,
        salonId: datos.salonId,
      };
      const creada = await apiFetch<RespuestaExito<Solicitud>>('/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solicitud),
      });
      const respuesta = await apiFetch<RespuestaExito<PresupuestoDetallado>>('/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, solicitudId: creada.data.id }),
      });
      return respuesta.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
    },
  });
}
