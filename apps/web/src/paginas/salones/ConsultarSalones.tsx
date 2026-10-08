import { useState } from 'react';

import { useSalones } from '@/hooks/use-salones';

// Mismo formato que los importes de negocio/tarifario-2026.md (separador de miles es-AR).
const formatoNumero = new Intl.NumberFormat('es-AR');

// Ficha de consulta de los salones (HU-03, criterios 1 y 3): los cinco salones con su capacidad,
// superficie y distribuciones. Es solo lectura; el alta y la edición no existen todavía (están
// previstas para el Sprint 4) y los datos se cargan por seed desde el tarifario.
//
// El filtro por capacidad mínima (criterio 2) y el aviso de "ninguno cubre esa capacidad, el mayor
// es X" (criterio 4) se sacaron de acá: el cotizador ya resuelve las dos cosas contra la cantidad
// de personas real del evento, que es el momento en que la pregunta se hace (CotizarEvento.tsx).
export function ConsultarSalones() {
  const { data: salones, isLoading, isError } = useSalones();
  const [salonSeleccionadoId, setSalonSeleccionadoId] = useState<number | null>(null);

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Cargando salones…</p>;
  }

  if (isError) {
    return <p className="p-6 text-destructive">No se pudo cargar el catálogo de salones.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Salones</h1>
        <p className="text-sm text-muted-foreground">
          Capacidad, superficie y distribuciones posibles de cada salón.
        </p>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {(salones ?? []).map((salon) => (
          <li key={salon.id}>
            <button
              type="button"
              onClick={() =>
                setSalonSeleccionadoId(salon.id === salonSeleccionadoId ? null : salon.id)
              }
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted"
              aria-expanded={salon.id === salonSeleccionadoId}
            >
              <span className="font-medium">{salon.nombre}</span>
              <span className="text-sm text-muted-foreground">
                {formatoNumero.format(salon.capacidadMaxima)} personas ·{' '}
                {formatoNumero.format(salon.superficie)} m²
              </span>
            </button>

            {salon.id === salonSeleccionadoId && (
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <p className="mb-2 text-sm font-medium">Distribuciones</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {salon.distribuciones.map((distribucion) => (
                    <li key={distribucion.id} className="flex justify-between">
                      <span>{distribucion.nombre}</span>
                      <span>{formatoNumero.format(distribucion.capacidad)} personas</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
