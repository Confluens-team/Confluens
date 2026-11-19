import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface Pestania<T extends string> {
  valor: T;
  texto: string;
  icono?: LucideIcon;
  // Un número chico al lado del texto (por ejemplo, cuántos cambios hay de ese tipo).
  cantidad?: number;
}

/**
 * Pestañas segmentadas de una pantalla (Auditoría para Gerencia y el detalle de una consulta o un
 * evento, 15/11/2026): un grupo con fondo beige y la elegida en papel con el texto en bordo. Van
 * arriba a la derecha del título; las pestañas principales del panel siguen siendo las subrayadas.
 */
export function Pestanias<T extends string>({
  pestanias,
  valor,
  onCambiar,
  etiqueta,
  className,
}: {
  pestanias: Pestania<T>[];
  valor: T;
  onCambiar: (valor: T) => void;
  etiqueta: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className={cn('inline-flex flex-wrap gap-1 rounded-xl bg-secondary p-1', className)}
    >
      {pestanias.map(({ valor: deEsta, texto, icono: Icono, cantidad }) => {
        const elegida = deEsta === valor;
        return (
          <button
            key={deEsta}
            type="button"
            role="tab"
            aria-selected={elegida}
            onClick={() => onCambiar(deEsta)}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
              elegida
                ? 'bg-card text-bordo shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icono && <Icono className="size-4" />}
            {texto}
            {cantidad !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  elegida ? 'bg-bordo/10 text-bordo' : 'bg-muted text-muted-foreground',
                )}
              >
                {cantidad}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
