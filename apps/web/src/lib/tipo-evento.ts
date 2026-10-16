import type { TipoEvento } from '@confluens/shared';

// Colores del tipo de evento en el panel (ADR 0008). Grafito para el corporativo y frambuesa para
// el social: bien separados entre sí y, como van sin relleno (contorno, borde y punto), no compiten
// con el color del estado, que es el único que rellena (tokens de index.css).
export const COLORES_TIPO_EVENTO: Record<
  TipoEvento,
  { badge: string; borde: string; punto: string }
> = {
  Corporativo: {
    badge: 'bg-transparent text-tipo-corporativo ring-tipo-corporativo-suave',
    borde: 'border-l-tipo-corporativo',
    punto: 'bg-tipo-corporativo',
  },
  Social: {
    badge: 'bg-transparent text-tipo-social ring-tipo-social-suave',
    borde: 'border-l-tipo-social',
    punto: 'bg-tipo-social',
  },
};
