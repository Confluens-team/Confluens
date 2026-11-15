import type { ConsultaDetallada } from '@confluens/shared';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { IconoEstado } from '@/components/IconoEstado';
import { formatearFechaNumerica } from '@/lib/formato';
import { cn } from '@/lib/utils';

// Las pestañas del detalle de una consulta (15/11/2026). Historial solo para el GG y el ADM.
export type PestaniaDeConsulta = 'detalle' | 'historial';

const ESTADOS: Record<string, string> = {
  Estimado: 'bg-estado-consulta-fondo text-estado-consulta-texto',
  Expirado: 'bg-estado-expirado-fondo text-estado-expirado-texto',
  Cancelado: 'bg-estado-cancelado-fondo text-estado-cancelado-texto',
  Confirmado: 'bg-estado-confirmado-fondo text-estado-confirmado-texto',
};

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * El título de una consulta, visible en todas sus pestañas (15/11/2026): número, estado, tipo y
 * fecha del evento, con lo de la derecha (las pestañas) arriba a la derecha.
 */
export function EncabezadoDeConsulta({
  consulta,
  extra,
  derecha,
}: {
  consulta: ConsultaDetallada;
  // Algo más al lado del estado (por ejemplo, «3 días»).
  extra?: React.ReactNode;
  derecha?: React.ReactNode;
}) {
  const { fecha, fechaFin } = consulta.evento;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-dorado/25 pb-4">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Un Confirmado ya no es una consulta: pasó a la agenda (HU-11 desde HU-15). */}
          <h2 className="text-xl font-semibold text-bordo">
            {consulta.estado === 'Confirmado' ? 'Presupuesto' : 'Consulta'} {consulta.id}
          </h2>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
              ESTADOS[consulta.estado] ?? '',
            )}
          >
            <IconoEstado estado={consulta.estado} />
            {consulta.estado}
          </span>
          <BadgeTipoEvento evento={consulta.evento} />
          {extra}
        </div>
        <p className="text-sm text-muted-foreground">
          Evento del {formatearFechaNumerica(fecha)}
          {fechaFin && fechaFin !== fecha && ` al ${formatearFechaNumerica(fechaFin)}`} · Emitida el{' '}
          {fechaCorta(consulta.fechaEmision)} ·{' '}
          {consulta.venceEn ? `vence el ${fechaCorta(consulta.venceEn)}` : 'presupuesto sin armar'}
        </p>
      </div>
      {derecha}
    </header>
  );
}
