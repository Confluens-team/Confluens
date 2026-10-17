import type { Etiqueta } from '@confluens/shared';
import { Tag } from 'lucide-react';

import { cn } from '@/lib/utils';

// Etiqueta interna del cliente (por ejemplo, la empresa en cuyo nombre reserva un empleado). Solo
// la ve el personal: el canal público nunca la recibe. Sin etiqueta no muestra nada. Va en el beige
// de la paleta para no confundirse con el tipo de evento ni con un estado.
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
        'inline-flex max-w-full items-center gap-1 truncate rounded-full bg-secondary px-2 py-0.5 align-middle text-xs font-semibold text-secondary-foreground ring-1 ring-dorado/30',
        className,
      )}
    >
      <Tag className="size-3 shrink-0" />
      <span className="truncate">{etiqueta.nombre}</span>
    </span>
  );
}
