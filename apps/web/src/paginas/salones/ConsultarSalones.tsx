import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { useSalones } from '@/hooks/use-salones';

// Mismo formato que los importes de negocio/tarifario-2026.md (separador de miles es-AR).
const formatoNumero = new Intl.NumberFormat('es-AR');

export function ConsultarSalones() {
  const { data: salones, isLoading, isError } = useSalones();
  const [capacidadMinima, setCapacidadMinima] = useState('');
  const [salonSeleccionadoId, setSalonSeleccionadoId] = useState<number | null>(null);

  // Filtro simple de un solo campo: no amerita React Hook Form (evita además el fix de
  // forwardRef que necesitaría <Input> para que el ref de RHF llegue al <input> nativo).
  const minimo = capacidadMinima === '' ? null : Number(capacidadMinima);

  // Criterio 2 (HU-01): filtrando por capacidad mínima N, solo aparecen los salones que la cubren.
  // Sin filtro se ven los cinco salones completos (criterio 1).
  const salonesFiltrados = useMemo(() => {
    if (!salones) return [];
    if (minimo === null || Number.isNaN(minimo)) return salones;
    return salones.filter((salon) => salon.capacidadMaxima >= minimo);
  }, [salones, minimo]);

  // Criterio 4: el repositorio ya ordena por capacidadMaxima desc (ver salones.repositorio.ts),
  // así que "la mayor disponible" es simplemente el primer salón de la lista sin filtrar.
  const salonMasGrande = salones?.[0] ?? null;
  const ningunoCubreLaCapacidad =
    minimo !== null &&
    !Number.isNaN(minimo) &&
    salones !== undefined &&
    salonesFiltrados.length === 0;

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

      <div className="max-w-xs space-y-1.5">
        <label htmlFor="capacidad-minima" className="text-sm font-medium">
          Capacidad mínima
        </label>
        <Input
          id="capacidad-minima"
          type="number"
          min={1}
          placeholder="Ej: 150"
          value={capacidadMinima}
          onChange={(evento) => setCapacidadMinima(evento.target.value)}
        />
      </div>

      {ningunoCubreLaCapacidad && salonMasGrande && (
        <p className="rounded-lg border border-input bg-muted/50 p-3 text-sm">
          Ningún salón cubre esa capacidad. El más grande disponible es{' '}
          <strong>{salonMasGrande.nombre}</strong> (
          {formatoNumero.format(salonMasGrande.capacidadMaxima)} personas).
        </p>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {salonesFiltrados.map((salon) => (
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
