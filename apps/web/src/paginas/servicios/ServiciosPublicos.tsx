import type { ServicioPublico } from '@confluens/shared';
import { useState } from 'react';

import { useServiciosPublicos } from '@/hooks/use-servicios';
import { agruparPorCategoria } from '@/lib/catalogo';
import { cn } from '@/lib/utils';

// Oferta gastronómica del canal público (HU-07). Son los servicios reales del catálogo, no un
// resumen escrito a mano: si se da de alta un servicio nuevo, aparece acá sin tocar código.
// Sin precios — el endpoint no los devuelve. Pensado para ir sobre el fondo bordó de la landing.
export function ServiciosPublicos() {
  const { data: servicios, isLoading, isError } = useServiciosPublicos();
  const [categoriaElegida, setCategoriaElegida] = useState<string | null>(null);

  if (isLoading) {
    return <p className="mt-8 text-sm text-crema/70">Cargando la carta…</p>;
  }

  if (isError) {
    return (
      <p className="mt-8 text-sm text-crema/80">
        No se pudo cargar la oferta gastronómica. Probá recargar la página.
      </p>
    );
  }

  if (!servicios || servicios.length === 0) {
    return (
      <p className="mt-8 text-sm text-crema/70">
        Estamos actualizando la carta. Consultanos y te la enviamos.
      </p>
    );
  }

  const grupos = agruparPorCategoria(servicios);
  const activa = categoriaElegida ?? grupos[0]?.[0];
  const delGrupo: ServicioPublico[] = grupos.find(([categoria]) => categoria === activa)?.[1] ?? [];

  return (
    <div className="mt-10">
      <div className="flex flex-wrap gap-2" role="tablist">
        {grupos.map(([categoria, items]) => (
          <button
            key={categoria}
            type="button"
            role="tab"
            aria-selected={categoria === activa}
            onClick={() => setCategoriaElegida(categoria)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-xs font-medium tracking-[0.12em] uppercase transition-colors',
              categoria === activa
                ? 'border-dorado bg-dorado text-bordo-oscuro'
                : 'border-crema/25 text-crema/80 hover:border-dorado hover:text-crema',
            )}
          >
            {categoria}
            <span className="ml-1.5 opacity-60">{items.length}</span>
          </button>
        ))}
      </div>

      <ul className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {delGrupo.map((servicio) => (
          <li key={servicio.id} className="border-b border-crema/10 pb-5">
            <h4 className="font-display text-xl font-medium text-crema">{servicio.nombre}</h4>
            <p className="mt-1 text-sm leading-relaxed text-crema/65">{servicio.descripcion}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
