import { Check, Minus } from 'lucide-react';

import { useListadoMediosPago } from '@/hooks/use-pagos';
import { cn } from '@/lib/utils';

function Habilitado({ si, caso }: { si: boolean; caso: string }) {
  return si ? (
    <Check className="mx-auto size-4 text-emerald-700" aria-label={`Se usa ${caso}`} />
  ) : (
    <Minus className="mx-auto size-4 text-muted-foreground" aria-label={`No se usa ${caso}`} />
  );
}

// HU-20: el catálogo de medios de pago, activos y dados de baja, en orden alfabético, con su estado
// y en qué cobros se puede usar cada uno (RN-14). Al cobrar se ofrecen solo los activos habilitados
// para el caso del presupuesto (CuentaDelEvento).
export function ListadoMediosPago() {
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
                <th className="px-3 py-2 text-center font-semibold">Con factura</th>
                <th className="px-3 py-2 text-center font-semibold">Sin factura</th>
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
                  <td className="px-3 py-2.5">
                    <Habilitado si={medio.conFactura} caso="con factura" />
                  </td>
                  <td className="px-3 py-2.5">
                    <Habilitado si={medio.sinFactura} caso="sin factura" />
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
