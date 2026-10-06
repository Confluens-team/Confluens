import type { EstadoEvento } from '@confluens/shared';

// Cómo se muestra cada estado del evento en la agenda (HU-15, criterio 2: "cada estado se
// distingue visualmente"). Está acá y no en cada componente porque el calendario y la lista tienen
// que coincidir: el mismo estado, el mismo nombre y el mismo color en las dos vistas.
//
// `Reservado` se muestra como «Confirmado»: es lo que el personal y el cliente entienden, y el
// valor del enum no cambia (dominio.md). Los colores son los de la paleta de index.css; `color` es
// el hex porque FullCalendar pinta los eventos por estilo, no por clase.
export const ESTADOS: Record<
  EstadoEvento,
  { etiqueta: string; color: string; clase: string; ayuda: string }
> = {
  Reservado: {
    etiqueta: 'Confirmado',
    color: '#047857',
    clase: 'bg-emerald-100 text-emerald-900',
    ayuda: 'Con la seña acreditada: el salón está ocupado',
  },
  Cobrado: {
    etiqueta: 'Cobrado',
    color: '#5e1f1a',
    clase: 'bg-bordo/10 text-bordo',
    ayuda: 'Pagado por completo: el salón está ocupado',
  },
  EnConsulta: {
    etiqueta: 'En consulta',
    color: '#b08d57',
    clase: 'bg-dorado/15 text-dorado',
    ayuda: 'Todavía no ocupa el salón: la franja sigue disponible',
  },
  Cancelado: {
    etiqueta: 'Cancelado',
    color: '#8a8580',
    clase: 'bg-muted text-muted-foreground',
    ayuda: 'Liberó el salón; no se muestra salvo que se pida',
  },
};

// Orden del filtro de estados: primero los dos que ocupan el salón, que son los que se muestran por
// defecto, y después los que hay que pedir a propósito.
export const ESTADOS_DEL_FILTRO: EstadoEvento[] = [
  'Reservado',
  'Cobrado',
  'EnConsulta',
  'Cancelado',
];
