import type { MedioPago } from '@confluens/shared';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useListadoMediosPago } from '@/hooks/use-pagos';
import { cn } from '@/lib/utils';

// HU-20: el catálogo de medios de pago, activos y dados de baja, en orden alfabético, con su estado.
// Al cobrar se ofrecen todos los activos (RN-14 desde HU-53). Cada fila se puede modificar (HU-33).
export function ListadoMediosPago({ onModificar }: { onModificar: (medio: MedioPago) => void }) {
  const { data: medios, isLoading, isError } = useListadoMediosPago();

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium">Catálogo actual</h2>
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && (
        <p className="text-sm text-destructive">No se pudo cargar el catálogo de medios de pago.</p>
      )}
      {medios && medios.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay medios de pago registrados.</p>
      )}
      {medios && medios.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">Medio</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {medios.map((medio) => (
                <tr key={medio.id} className={cn(!medio.activo && 'text-muted-foreground')}>
                  <td className="px-3 py-2.5 font-medium">{medio.nombre}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        medio.activo
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {medio.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-1 py-1 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Modificar ${medio.nombre}`}
                      onClick={() => onModificar(medio)}
                    >
                      <Pencil />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
