import type { RegistroAuditoria } from '@confluens/shared';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

import { Cargando } from '@/components/PantallaDeCarga';
import { useHistorialDeEvento } from '@/hooks/use-auditoria';
import {
  cantidadDeCampos,
  etiquetaDeRegistro,
  formatearFechaHora,
  formatearValor,
  nombreDeCampo,
  resumenDelCambio,
} from '@/lib/auditoria';
import { versionDe } from '@/lib/historial-auditoria';
import { cn } from '@/lib/utils';
import { BotonRevisado, ChipSensible, Inicial } from './piezas';

function VersionElegida({
  registro,
  historial,
}: {
  registro: RegistroAuditoria;
  historial: RegistroAuditoria[];
}) {
  const [soloLoQueCambio, setSoloLoQueCambio] = useState(false);
  const version = versionDe(historial, registro.id);
  const campos = (version?.campos ?? []).filter((campo) => !soloLoQueCambio || campo.cambio);

  return (
    <section
      aria-label="Versión elegida"
      className="min-w-0 overflow-hidden rounded-xl bg-card ring-1 ring-border"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-0.5">
          <h3 className="font-semibold">
            {resumenDelCambio(registro)} ·{' '}
            <span className="text-bordo">{etiquetaDeRegistro(registro)}</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            {registro.usuario?.email ?? 'Sistema'} · {formatearFechaHora(registro.fecha)} ·{' '}
            {cantidadDeCampos(registro)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-bordo)]"
              checked={soloLoQueCambio}
              onChange={(e) => setSoloLoQueCambio(e.target.checked)}
            />
            Solo lo que cambió
          </label>
          <BotonRevisado registro={registro} texto="Marcar como revisado" />
        </div>
      </div>
      {version && !version.completo && !soloLoQueCambio && (
        <p className="border-b border-border bg-muted/50 px-5 py-2 text-xs text-muted-foreground">
          El alta de este registro es anterior a la auditoría: se ven los campos que cambiaron desde
          entonces.
        </p>
      )}
      <dl>
        {campos.map(({ campo, antes, despues, cambio }) => (
          <div
            key={campo}
            className={cn(
              'grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-4 border-b border-border px-5 py-2.5 last:border-b-0',
              cambio && registro.tipo !== 'alta' && 'bg-dorado/10',
            )}
          >
            <dt className="text-sm font-medium text-muted-foreground">{nombreDeCampo(campo)}</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
              {cambio && registro.tipo !== 'alta' && (
                <>
                  <span className="rounded-md bg-estado-expirado-fondo px-2 py-0.5 text-estado-expirado-texto line-through">
                    {formatearValor(campo, antes)}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </>
              )}
              <span
                className={cn(
                  'break-words',
                  cambio &&
                    registro.tipo !== 'alta' &&
                    'font-semibold text-estado-confirmado-texto',
                )}
              >
                {formatearValor(campo, despues)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Diseño D (historial dentro de cada registro, 15/11/2026): cada cambio del evento y de lo que
 * cuelga de él (presupuestos, pagos, solicitud) como una versión. A la derecha la lista, a la
 * izquierda la versión elegida campo por campo. Solo lectura: no se restaura nada.
 */
export function HistorialDelRegistro({ eventoId }: { eventoId: number }) {
  const { data: historial, isLoading, isError } = useHistorialDeEvento(eventoId);
  const [elegido, setElegido] = useState<number | null>(null);

  if (isLoading) return <Cargando texto="Cargando el historial…" />;
  if (isError || !historial) {
    return <p className="text-sm text-destructive">No se pudo cargar el historial.</p>;
  }
  if (historial.length === 0) {
    return (
      <p className="rounded-xl bg-card px-5 py-8 text-center text-sm text-muted-foreground ring-1 ring-border">
        Todavía no hay cambios registrados. Lo que pide un cliente desde la web no queda en la
        auditoría: aparece desde el primer cambio del personal.
      </p>
    );
  }

  const seleccionado = historial.find((registro) => registro.id === elegido) ?? historial[0]!;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <VersionElegida key={seleccionado.id} registro={seleccionado} historial={historial} />
      <aside
        aria-label="Versiones"
        className="space-y-1.5 rounded-xl bg-card p-3 ring-1 ring-border"
      >
        <h3 className="px-2 pt-1 pb-1.5 font-semibold">Versiones</h3>
        {historial.map((registro) => {
          const esElegido = registro.id === seleccionado.id;
          return (
            <button
              key={registro.id}
              type="button"
              aria-pressed={esElegido}
              onClick={() => setElegido(registro.id)}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors',
                esElegido
                  ? 'border-bordo/40 bg-secondary/70'
                  : 'border-transparent hover:bg-muted/60',
              )}
            >
              <Inicial usuario={registro.usuario} className="size-7 text-[0.65rem]" />
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-semibold">{resumenDelCambio(registro)}</span>
                <span className="block text-xs text-muted-foreground">
                  {etiquetaDeRegistro(registro)} · {registro.usuario?.email ?? 'Sistema'}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {formatearFechaHora(registro.fecha)} · {cantidadDeCampos(registro)}
                  <ChipSensible registro={registro} />
                </span>
              </span>
            </button>
          );
        })}
      </aside>
    </div>
  );
}
