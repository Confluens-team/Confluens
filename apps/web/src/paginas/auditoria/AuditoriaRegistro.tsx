import {
  ENTIDADES_AUDITADAS,
  type EntidadAuditada,
  hoyEnZonaEventos,
  type RegistroAuditoria,
  type TipoDeAccion,
} from '@confluens/shared';
import { ChevronLeft, ChevronRight, Download, History, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';

import { Pestanias } from '@/components/Pestanias';
import { SelectorFecha } from '@/components/SelectorFechaHora';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type FiltrosAuditoriaWeb, urlDeExportacion, useAuditoria } from '@/hooks/use-auditoria';
import { useUsuarios } from '@/hooks/use-usuarios';
import {
  etiquetaDeRegistro,
  formatearFechaHora,
  NOMBRES_DE_ENTIDAD,
  resumenDelCambio,
} from '@/lib/auditoria';
import { NOMBRES_DE_ROL } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { CLASES_SELECT } from '@/paginas/eventos/clases-select';
import { BotonRevisado, ChipAccion, ChipSensible, Inicial, ListaDeCambios } from './piezas';

// Valor del select de usuario que pide solo lo que hizo el Sistema.
const SISTEMA = 'sistema';

type Periodo = 'todo' | 'hoy' | 'semana' | 'mes' | 'personalizado';
type PestaniaDeTipo = 'todo' | TipoDeAccion;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Las fechas de cada período, en días de calendario de Córdoba (ADR 0010).
function rangoDePeriodo(periodo: Periodo): { desde?: string; hasta?: string } {
  const hoy = hoyEnZonaEventos();
  if (periodo === 'hoy') return { desde: hoy, hasta: hoy };
  if (periodo === 'semana') {
    const hace6 = new Date(Date.parse(`${hoy}T12:00:00Z`) - 6 * MS_POR_DIA);
    return { desde: hace6.toISOString().slice(0, 10), hasta: hoy };
  }
  if (periodo === 'mes') return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  return {};
}

// «Hoy 18:42», «Ayer 09:02» o «13/11 20:47».
function cuando(iso: string): { dia: string; hora: string } {
  const completo = formatearFechaHora(iso);
  const [fecha = '', hora = ''] = completo.split(', ');
  const hoy = hoyEnZonaEventos();
  const ayer = new Date(Date.parse(`${hoy}T12:00:00Z`) - MS_POR_DIA).toISOString().slice(0, 10);
  const diaDelCambio = hoyEnZonaEventos(new Date(iso));
  const dia =
    diaDelCambio === hoy
      ? 'Hoy'
      : diaDelCambio === ayer
        ? 'Ayer'
        : fecha.split('/').slice(0, 2).join('/');
  return { dia, hora };
}

const COLUMNAS =
  'grid grid-cols-[4.5rem_minmax(10rem,1.1fr)_7rem_minmax(9rem,1.1fr)_minmax(10rem,1.3fr)] gap-3';

function DetalleDelCambio({
  registro,
  onVerHistorial,
}: {
  registro: RegistroAuditoria;
  onVerHistorial: () => void;
}) {
  return (
    <aside
      aria-label="Detalle del cambio"
      className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-border"
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <ChipAccion tipo={registro.tipo} />
          <span className="text-xs text-muted-foreground">
            {formatearFechaHora(registro.fecha)}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-bordo">{etiquetaDeRegistro(registro)}</h3>
        <p className="text-sm text-muted-foreground">{resumenDelCambio(registro)}</p>
      </div>

      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 rounded-lg bg-secondary/60 p-3 text-sm">
        <dt className="text-muted-foreground">Usuario</dt>
        <dd className="min-w-0 font-medium break-words">
          {registro.usuario
            ? `${registro.usuario.email} · ${NOMBRES_DE_ROL[registro.usuario.rol]}`
            : 'Sistema (proceso automático)'}
        </dd>
        <dt className="text-muted-foreground">Parte del sistema</dt>
        <dd>{NOMBRES_DE_ENTIDAD[registro.entidad as EntidadAuditada] ?? registro.entidad}</dd>
        {registro.revision && (
          <>
            <dt className="text-muted-foreground">Revisado</dt>
            <dd className="min-w-0 break-words">
              {registro.revision.usuario.email} · {formatearFechaHora(registro.revision.fecha)}
            </dd>
          </>
        )}
      </dl>

      <div className="space-y-2">
        <h4 className="text-[0.65rem] font-semibold tracking-[0.15em] text-dorado-texto uppercase">
          Cambios
        </h4>
        <ListaDeCambios registro={registro} />
      </div>

      {registro.sensible && (
        <p className="flex gap-2 rounded-lg bg-dorado/15 px-3 py-2.5 text-sm text-dorado-texto">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Cambio sensible.</strong>{' '}
            {registro.requiereRevision
              ? registro.revision
                ? 'Toca plata o permisos y ya fue revisado.'
                : 'Toca plata o permisos: aparece en «Para revisar» del Resumen.'
              : 'Toca plata o permisos. Lo hizo la gerencia o el Sistema: no requiere revisión.'}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <BotonRevisado registro={registro} texto="Marcar como revisado" />
        <Button type="button" variant="outline" onClick={onVerHistorial}>
          <History /> Ver historial del registro
        </Button>
      </div>
    </aside>
  );
}

/**
 * Diseño A: el registro de la auditoría con filtros, pestañas por tipo de acción y el detalle del
 * cambio elegido al costado. Solo lectura, salvo «Marcar como revisado» para el Gerente General.
 */
export function AuditoriaRegistro({ soloPendientes = false }: { soloPendientes?: boolean }) {
  const [filtros, setFiltros] = useState<FiltrosAuditoriaWeb>(() => ({
    page: 1,
    ...(soloPendientes && { pendientes: true }),
  }));
  const [periodo, setPeriodo] = useState<Periodo>('todo');
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState<number | null>(null);
  const { data: respuesta, isLoading, isError, isFetching } = useAuditoria(filtros);
  const { data: usuarios } = useUsuarios();

  // Cambiar un filtro vuelve a la primera página.
  function filtrar(cambios: Partial<FiltrosAuditoriaWeb>) {
    setFiltros((anteriores) => ({ ...anteriores, ...cambios, page: 1 }));
    setElegido(null);
  }

  function elegirPeriodo(nuevo: Periodo) {
    setPeriodo(nuevo);
    if (nuevo !== 'personalizado')
      filtrar({ desde: undefined, hasta: undefined, ...rangoDePeriodo(nuevo) });
  }

  const registros = respuesta?.data ?? [];
  const meta = respuesta?.meta;
  const paginas = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  const usuarioElegido = filtros.sistema ? SISTEMA : (filtros.usuarioId?.toString() ?? '');
  const seleccionado = registros.find((registro) => registro.id === elegido) ?? registros[0];
  const { page: _pagina, ...filtrosDeExportacion } = filtros;

  return (
    <div className="space-y-4">
      <section
        aria-label="Filtros"
        className="flex flex-wrap items-end gap-3 rounded-xl bg-card p-4 ring-1 ring-border"
      >
        <form
          className="min-w-0 flex-[2_1_16rem] space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            filtrar({ buscar: busqueda.trim() || undefined });
          }}
        >
          <Label htmlFor="auditoria-buscar">Buscar</Label>
          <Input
            id="auditoria-buscar"
            type="search"
            placeholder="Usuario, número de registro o campo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onBlur={() => filtrar({ buscar: busqueda.trim() || undefined })}
          />
        </form>
        <div className="min-w-0 flex-[1_1_11rem] space-y-1.5">
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
        <div className="min-w-0 flex-[1_1_11rem] space-y-1.5">
          <Label htmlFor="auditoria-entidad">Parte del sistema</Label>
          <select
            id="auditoria-entidad"
            className={CLASES_SELECT}
            value={filtros.entidad ?? ''}
            onChange={(e) =>
              filtrar({
                entidad: (e.target.value || undefined) as EntidadAuditada | undefined,
                entidadId: undefined,
              })
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
        <div className="min-w-0 flex-[1_1_10rem] space-y-1.5">
          <Label htmlFor="auditoria-periodo">Período</Label>
          <select
            id="auditoria-periodo"
            className={CLASES_SELECT}
            value={periodo}
            onChange={(e) => elegirPeriodo(e.target.value as Periodo)}
          >
            <option value="todo">Todo</option>
            <option value="hoy">Hoy</option>
            <option value="semana">Últimos 7 días</option>
            <option value="mes">Este mes</option>
            <option value="personalizado">Personalizado…</option>
          </select>
        </div>
        {periodo === 'personalizado' && (
          <>
            <div className="min-w-0 flex-[1_1_9rem] space-y-1.5">
              <Label htmlFor="auditoria-desde">Desde</Label>
              <SelectorFecha
                id="auditoria-desde"
                value={filtros.desde ?? ''}
                onChange={(valor) => filtrar({ desde: valor || undefined })}
              />
            </div>
            <div className="min-w-0 flex-[1_1_9rem] space-y-1.5">
              <Label htmlFor="auditoria-hasta">Hasta</Label>
              <SelectorFecha
                id="auditoria-hasta"
                value={filtros.hasta ?? ''}
                diaMinimo={filtros.desde}
                onChange={(valor) => filtrar({ hasta: valor || undefined })}
              />
            </div>
          </>
        )}
        <a
          href={urlDeExportacion(filtrosDeExportacion)}
          download="auditoria.csv"
          className={buttonVariants({ variant: 'outline' })}
        >
          <Download /> Exportar CSV
        </a>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pestanias<PestaniaDeTipo>
          etiqueta="Tipo de acción"
          valor={filtros.tipo ?? 'todo'}
          onCambiar={(tipo) => filtrar({ tipo: tipo === 'todo' ? undefined : tipo })}
          pestanias={[
            { valor: 'todo', texto: 'Todo', cantidad: meta?.conteos.todo },
            { valor: 'alta', texto: 'Altas', cantidad: meta?.conteos.alta },
            {
              valor: 'modificacion',
              texto: 'Modificaciones',
              cantidad: meta?.conteos.modificacion,
            },
            { valor: 'baja', texto: 'Bajas y anulaciones', cantidad: meta?.conteos.baja },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          {filtros.pendientes && (
            <button
              type="button"
              onClick={() => filtrar({ pendientes: undefined })}
              className="inline-flex items-center gap-1 rounded-full bg-dorado/20 px-3 py-1 text-xs font-semibold text-dorado-texto"
            >
              Solo pendientes de revisión <X className="size-3.5" aria-label="Quitar" />
            </button>
          )}
          {filtros.entidadId && (
            <button
              type="button"
              onClick={() => filtrar({ entidad: undefined, entidadId: undefined })}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-bordo"
            >
              {etiquetaDeRegistro({ entidad: filtros.entidad ?? '', entidadId: filtros.entidadId })}{' '}
              <X className="size-3.5" aria-label="Quitar" />
            </button>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-dorado-texto)]"
              checked={!!filtros.sensibles}
              onChange={(e) => filtrar({ sensibles: e.target.checked || undefined })}
            />
            Solo cambios sensibles
          </label>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && <p className="text-sm text-destructive">No se pudo cargar la auditoría.</p>}

      {meta && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
          <section
            aria-label="Registro de cambios"
            className={cn(
              'overflow-hidden rounded-xl bg-card ring-1 ring-border',
              isFetching && 'opacity-70',
            )}
          >
            <div className="overflow-x-auto">
              <div className="min-w-[44rem]">
                <div
                  className={cn(
                    COLUMNAS,
                    'border-b border-border bg-secondary/50 px-5 py-2.5 text-[0.65rem] font-semibold tracking-[0.15em] text-muted-foreground uppercase',
                  )}
                >
                  <span>Cuándo</span>
                  <span>Quién</span>
                  <span>Acción</span>
                  <span>Registro</span>
                  <span>Qué cambió</span>
                </div>
                {registros.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No hay cambios con estos filtros.
                  </p>
                )}
                {registros.map((registro) => {
                  const esElegido = registro.id === seleccionado?.id;
                  const { dia, hora } = cuando(registro.fecha);
                  return (
                    <button
                      key={registro.id}
                      type="button"
                      aria-pressed={esElegido}
                      onClick={() => setElegido(registro.id)}
                      className={cn(
                        COLUMNAS,
                        'w-full items-center border-b border-border px-5 py-3 text-left text-sm transition-colors last:border-b-0',
                        esElegido
                          ? 'bg-secondary/70 shadow-[inset_3px_0_0_var(--color-bordo)]'
                          : 'hover:bg-muted/50',
                      )}
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">{dia}</span>
                        <span className="text-xs text-muted-foreground">{hora}</span>
                      </span>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Inicial usuario={registro.usuario} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {registro.usuario?.email ?? 'Sistema'}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {registro.usuario
                              ? NOMBRES_DE_ROL[registro.usuario.rol]
                              : 'Proceso automático'}
                          </span>
                        </span>
                      </span>
                      <span>
                        <ChipAccion tipo={registro.tipo} />
                      </span>
                      <span className="flex flex-col items-start gap-1">
                        <span className="font-medium">{etiquetaDeRegistro(registro)}</span>
                        <ChipSensible registro={registro} />
                      </span>
                      <span className="text-muted-foreground">{resumenDelCambio(registro)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted-foreground">
              <span>
                {meta.total === 1 ? '1 cambio' : `${meta.total} cambios`} · página {meta.page} de{' '}
                {paginas}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={filtros.page <= 1}
                  onClick={() => setFiltros((f) => ({ ...f, page: f.page - 1 }))}
                >
                  <ChevronLeft /> Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={filtros.page >= paginas}
                  onClick={() => setFiltros((f) => ({ ...f, page: f.page + 1 }))}
                >
                  Siguiente <ChevronRight />
                </Button>
              </div>
            </div>
          </section>

          {seleccionado && (
            <DetalleDelCambio
              registro={seleccionado}
              onVerHistorial={() =>
                filtrar({
                  entidad: seleccionado.entidad as EntidadAuditada,
                  entidadId: seleccionado.entidadId,
                  tipo: undefined,
                })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
