import {
  ENTIDADES_AUDITADAS,
  type EntidadAuditada,
  type RegistroAuditoria,
} from '@confluens/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuditoria, useCamposAuditados, type FiltrosAuditoriaWeb } from '@/hooks/use-auditoria';
import { useUsuarios } from '@/hooks/use-usuarios';
import {
  formatearFechaHora,
  formatearValor,
  NOMBRES_DE_ENTIDAD,
  nombreDeCampo,
} from '@/lib/auditoria';
import { CLASES_SELECT } from '@/paginas/eventos/clases-select';

// Valor del select de usuario que pide solo lo que hizo el Sistema.
const SISTEMA = 'sistema';

// Una fila por campo que cambió: así se lee «quién cambió qué» sin abrir el registro.
function filasDeCambio(registro: RegistroAuditoria) {
  return registro.campos.map((campo) => ({
    campo,
    anterior: registro.valorAnterior?.[campo],
    nuevo: registro.valorNuevo?.[campo],
  }));
}

/**
 * HU-25 del backlog: la pestaña Auditoría de Configuración de negocio, solo para el GG y el ADM
 * (la API se la niega al resto). Cada cambio con su fecha, usuario, parte del sistema, campo, valor
 * anterior y valor nuevo, del más reciente al más antiguo, con filtro por campo auditado, parte del
 * sistema, usuario y fechas. Es de solo lectura: el registro no se modifica ni se borra.
 */
export function Auditoria() {
  const [filtros, setFiltros] = useState<FiltrosAuditoriaWeb>({ page: 1 });
  const { data: respuesta, isLoading, isError, isFetching } = useAuditoria(filtros);
  const { data: campos } = useCamposAuditados();
  const { data: usuarios } = useUsuarios();

  // Cambiar un filtro vuelve a la primera página.
  function filtrar(cambios: Partial<FiltrosAuditoriaWeb>) {
    setFiltros((anteriores) => ({ ...anteriores, ...cambios, page: 1 }));
  }

  const registros = respuesta?.data ?? [];
  const meta = respuesta?.meta;
  const paginas = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  const usuarioElegido = filtros.sistema ? SISTEMA : (filtros.usuarioId?.toString() ?? '');

  return (
    <div className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-medium">Auditoría</h2>
        <p className="text-sm text-muted-foreground">
          Quién cambió qué y cuándo en el panel interno. «Sistema» son las tareas automáticas, como
          el vencimiento de los presupuestos o el recálculo por el incremento.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="auditoria-campo">Campo</Label>
          <select
            id="auditoria-campo"
            className={CLASES_SELECT}
            value={filtros.campo ?? ''}
            onChange={(e) => filtrar({ campo: e.target.value || undefined })}
          >
            <option value="">Todos los campos</option>
            {campos?.map((campo) => (
              <option key={campo} value={campo}>
                {nombreDeCampo(campo)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auditoria-entidad">Parte del sistema</Label>
          <select
            id="auditoria-entidad"
            className={CLASES_SELECT}
            value={filtros.entidad ?? ''}
            onChange={(e) =>
              filtrar({ entidad: (e.target.value || undefined) as EntidadAuditada | undefined })
            }
          >
            <option value="">Todas</option>
            {ENTIDADES_AUDITADAS.map((entidad) => (
              <option key={entidad} value={entidad}>
                {NOMBRES_DE_ENTIDAD[entidad]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auditoria-usuario">Usuario</Label>
          <select
            id="auditoria-usuario"
            className={CLASES_SELECT}
            value={usuarioElegido}
            onChange={(e) => {
              const valor = e.target.value;
              filtrar(
                valor === SISTEMA
                  ? { sistema: true, usuarioId: undefined }
                  : { sistema: undefined, usuarioId: valor ? Number(valor) : undefined },
              );
            }}
          >
            <option value="">Todos</option>
            <option value={SISTEMA}>Sistema</option>
            {usuarios?.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.email}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auditoria-desde">Desde</Label>
          <Input
            id="auditoria-desde"
            type="date"
            value={filtros.desde ?? ''}
            onChange={(e) => filtrar({ desde: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auditoria-hasta">Hasta</Label>
          <Input
            id="auditoria-hasta"
            type="date"
            min={filtros.desde}
            value={filtros.hasta ?? ''}
            onChange={(e) => filtrar({ hasta: e.target.value || undefined })}
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && <p className="text-sm text-destructive">No se pudo cargar la auditoría.</p>}
      {respuesta && registros.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay cambios con esos filtros.</p>
      )}

      {registros.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Usuario</th>
                <th className="px-3 py-2 font-semibold">Parte del sistema</th>
                <th className="px-3 py-2 font-semibold">Campo</th>
                <th className="px-3 py-2 font-semibold">Valor anterior</th>
                <th className="px-3 py-2 font-semibold">Valor nuevo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {registros.map((registro) =>
                filasDeCambio(registro).map(({ campo, anterior, nuevo }, indice) => (
                  <tr key={`${registro.id}-${campo}`} className="align-top">
                    {/* Fecha, usuario y parte una sola vez por cambio, aunque toque varios campos. */}
                    {indice === 0 && (
                      <>
                        <td
                          rowSpan={registro.campos.length}
                          className="px-3 py-2.5 whitespace-nowrap text-muted-foreground"
                        >
                          {formatearFechaHora(registro.fecha)}
                        </td>
                        <td rowSpan={registro.campos.length} className="px-3 py-2.5">
                          {registro.usuario?.email ?? (
                            <span className="text-muted-foreground italic">Sistema</span>
                          )}
                        </td>
                        <td
                          rowSpan={registro.campos.length}
                          className="px-3 py-2.5 whitespace-nowrap"
                        >
                          {NOMBRES_DE_ENTIDAD[registro.entidad as EntidadAuditada] ??
                            registro.entidad}{' '}
                          <span className="text-muted-foreground">#{registro.entidadId}</span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      {nombreDeCampo(campo)}
                    </td>
                    <td className="max-w-xs px-3 py-2.5 break-words text-muted-foreground">
                      {registro.valorAnterior === null ? 'Alta' : formatearValor(campo, anterior)}
                    </td>
                    <td className="max-w-xs px-3 py-2.5 break-words">
                      {formatearValor(campo, nuevo)}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {meta.total} {meta.total === 1 ? 'cambio' : 'cambios'} · página {meta.page} de {paginas}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={filtros.page <= 1 || isFetching}
              onClick={() =>
                setFiltros((anteriores) => ({ ...anteriores, page: anteriores.page - 1 }))
              }
            >
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={filtros.page >= paginas || isFetching}
              onClick={() =>
                setFiltros((anteriores) => ({ ...anteriores, page: anteriores.page + 1 }))
              }
            >
              Siguiente <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
