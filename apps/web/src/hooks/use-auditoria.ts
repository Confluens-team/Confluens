import type { FiltrosAuditoria, RegistroAuditoria, RespuestaExito } from '@confluens/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// Los filtros como los arma el formulario: todo opcional salvo la página.
export type FiltrosAuditoriaWeb = Partial<Omit<FiltrosAuditoria, 'page' | 'pageSize'>> & {
  page: number;
};

// HU-25 del backlog: una página de la auditoría, del cambio más reciente al más antiguo. Los
// filtros los resuelve la API; la página anterior queda a la vista mientras carga la siguiente.
export function useAuditoria(filtros: FiltrosAuditoriaWeb) {
  return useQuery({
    queryKey: ['auditoria', filtros],
    queryFn: async () => {
      const parametros = new URLSearchParams();
      for (const [clave, valor] of Object.entries(filtros)) {
        if (valor !== undefined && valor !== '') parametros.set(clave, String(valor));
      }
      return apiFetch<RespuestaExito<RegistroAuditoria[]>>(`/auditoria?${parametros}`);
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
