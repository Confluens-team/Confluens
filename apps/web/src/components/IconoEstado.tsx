import { Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';

// El tacho que acompaña al estado Cancelado en badges y filtros (decisión de Franco, 16/10/2026).
// Sirve igual para el evento y para el presupuesto, que usan el mismo literal. Los demás estados no
// llevan ícono: no muestra nada.
export function IconoEstado({ estado, className }: { estado?: string; className?: string }) {
  if (estado !== 'Cancelado') return null;
  return <Trash2 className={cn('size-3 shrink-0', className)} aria-hidden />;
}
