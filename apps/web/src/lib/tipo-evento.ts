import type { TipoEvento } from '@confluens/shared';

// Colores del tipo de evento en el panel (ADR 0008). Azul y rosa para no confundirse con los de
// estado (gris, ámbar, bordó, esmeralda y dorado).
export const COLORES_TIPO_EVENTO: Record<
  TipoEvento,
  { badge: string; borde: string; punto: string }
> = {
  Corporativo: {
    badge: 'bg-sky-100 text-sky-900 ring-sky-200',
    borde: 'border-l-sky-500',
    punto: 'bg-sky-500',
  },
  Social: {
    badge: 'bg-rose-100 text-rose-900 ring-rose-200',
    borde: 'border-l-rose-500',
    punto: 'bg-rose-500',
  },
};
