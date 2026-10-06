import type {
  ConsultaDetallada,
  CrearPresupuesto,
  CrearSolicitud,
  FiltrosPresupuestos,
  ModificarPresupuesto,
  PresupuestoDetallado,
  PresupuestoListado,
  RespuestaExito,
  Solicitud,
} from '@confluens/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Cotizador del cliente registrado (landing). Registra primero la Solicitud —así la consulta le
// aparece al Responsable de Eventos en su listado, igual que las del formulario público— y después
// genera el Presupuesto Estimado vinculado a ella (HU-15).
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
      void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
    },
  });
}

// HU-10: listado del personal. Solo viajan los filtros con valor; mientras llega la respuesta de
// un filtro nuevo se sigue mostrando la anterior, para que la tabla no parpadee al escribir.
export function usePresupuestos(filtros: FiltrosPresupuestos) {
  return useQuery({
    queryKey: ['presupuestos', filtros],
    queryFn: async () => {
      const parametros = new URLSearchParams(
        Object.entries(filtros).filter((par): par is [string, string] => !!par[1]),
      );
      const consulta = parametros.size > 0 ? `?${parametros}` : '';
      const respuesta = await apiFetch<RespuestaExito<PresupuestoListado[]>>(
        `/presupuestos${consulta}`,
      );
      return respuesta.data;
    },
    placeholderData: keepPreviousData,
  });
}

// HU-12: una consulta con todo lo necesario para mostrarla y editarla.
export function useConsulta(id: number) {
  return useQuery({
    queryKey: ['presupuestos', 'consulta', id],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<ConsultaDetallada>>(`/presupuestos/${id}`);
      return respuesta.data;
    },
  });
}

// Modificar (también recalcular) o dar de baja cambian el listado, la consulta y el evento (su detalle y la
// agenda): se invalida todo eso.
function useAccionSobreConsulta<T>(accion: (datos: T) => Promise<ConsultaDetallada>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: accion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
      void queryClient.invalidateQueries({ queryKey: ['eventos'] });
    },
  });
}

export function useModificarConsulta(id: number) {
  return useAccionSobreConsulta(async (datos: ModificarPresupuesto) => {
    const respuesta = await apiFetch<RespuestaExito<ConsultaDetallada>>(`/presupuestos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    return respuesta.data;
  });
}

export function useDarDeBajaConsulta(id: number) {
  return useAccionSobreConsulta(async () => {
    const respuesta = await apiFetch<RespuestaExito<ConsultaDetallada>>(
      `/presupuestos/${id}/dar-de-baja`,
      { method: 'POST' },
    );
    return respuesta.data;
  });
}
