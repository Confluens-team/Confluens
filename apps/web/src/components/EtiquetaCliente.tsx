import type { Etiqueta } from '@confluens/shared';
import { Tag } from 'lucide-react';

import { cn } from '@/lib/utils';

// Etiqueta interna del cliente (por ejemplo, la empresa en cuyo nombre reserva un empleado). Solo
// la ve el personal: el canal público nunca la recibe. Sin etiqueta no muestra nada.
export function EtiquetaCliente({
  etiqueta,
  className,
}: {
  etiqueta: Etiqueta | null | undefined;
  className?: string;
}) {
  if (!etiqueta) return null;
  return (
    <span
      title={`Etiqueta: ${etiqueta.nombre}`}
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded-full bg-sky-100 px-2 py-0.5 align-middle text-xs font-semibold text-sky-900 ring-1 ring-sky-200',
        className,
      )}
    >
      <Tag className="size-3 shrink-0" />
      <span className="truncate">{etiqueta.nombre}</span>
    </span>
  );
}
