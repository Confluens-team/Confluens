import type {
  FiltrosAuditoria,
  MetaAuditoria,
  RegistroAuditoria,
  RespuestaExito,
  ResumenAuditoria,
  RevisionAuditoria,
} from '@confluens/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSesion } from '@/hooks/use-sesion';
import { apiFetch } from '@/lib/api';

// Los filtros como los arma el formulario: todo opcional salvo la página.
export type FiltrosAuditoriaWeb = Partial<Omit<FiltrosAuditoria, 'page' | 'pageSize'>> & {
  page: number;
};

// Los filtros como query string, sin los vacíos.
export function queryDeFiltros(filtros: Partial<Record<string, unknown>>): string {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== '' && valor !== false)
      parametros.set(clave, String(valor));
  }
  return parametros.toString();
}

// HU-25 del backlog: una página de la auditoría, del cambio más reciente al más antiguo, con cuántos
// hay de cada tipo (las pestañas del Registro). La página anterior queda a la vista mientras carga.
export function useAuditoria(filtros: FiltrosAuditoriaWeb) {
  return useQuery({
    queryKey: ['auditoria', 'registro', filtros],
    queryFn: async () => {
      const respuesta = await apiFetch<RespuestaExito<RegistroAuditoria[]>>(
        `/auditoria?${queryDeFiltros(filtros)}`,
      );
      return { data: respuesta.data, meta: respuesta.meta as unknown as MetaAuditoria };
    },
    placeholderData: keepPreviousData,
  });
}

// Los campos que aparecen en la auditoría, para el filtro por campo.
export function useCamposAuditados() {
  return useQuery({
    queryKey: ['auditoria', 'campos'],
    queryFn: async () => (await apiFetch<RespuestaExito<string[]>>('/auditoria/campos')).data,
  });
}

// Diseño B: el resumen de los últimos días para el Gerente General.
export function useResumenAuditoria(dias = 7) {
  return useQuery({
    queryKey: ['auditoria', 'resumen', dias],
    queryFn: async () =>
      (await apiFetch<RespuestaExito<ResumenAuditoria>>(`/auditoria/resumen?dias=${dias}`)).data,
  });
}

// Diseño D: los cambios de un evento y de lo que cuelga de él, del más nuevo al más viejo.
export function useHistorialDeEvento(eventoId: number, habilitado = true) {
  return useQuery({
    queryKey: ['auditoria', 'evento', eventoId],
    queryFn: async () =>
      (await apiFetch<RespuestaExito<RegistroAuditoria[]>>(`/auditoria/evento/${eventoId}`)).data,
    enabled: habilitado,
  });
}

// El Gerente General marca un cambio sensible como revisado: se refresca toda la auditoría.
export function useMarcarRevisado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (auditLogId: number) =>
      (
        await apiFetch<RespuestaExito<RevisionAuditoria>>(`/auditoria/${auditLogId}/revision`, {
          method: 'POST',
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auditoria'] }),
  });
}

// La dirección del CSV con los filtros del Registro (la descarga la hace el navegador).
export function urlDeExportacion(filtros: Partial<Record<string, unknown>>): string {
  return `${import.meta.env.VITE_API_URL ?? ''}/api/auditoria/exportar?${queryDeFiltros(filtros)}`;
}

/** Si quien mira es el Gerente General, el único que marca un cambio como revisado. */
export function useEsGerente(): boolean {
  const { data: sesion } = useSesion();
  return sesion?.rol === 'GERENTE_GENERAL';
}
