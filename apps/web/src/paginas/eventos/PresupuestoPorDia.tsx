import type { EventoDetallado } from '@confluens/shared';
import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { textoModalidad } from '@/lib/formato';

const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

type Presupuesto = EventoDetallado['presupuestos'][number];

/**
 * HU-50: el presupuesto de un evento de varios días, de a un día. El selector de arriba
 * (NavegadorDeDias) elige el día y esta tarjeta muestra los ítems de ESE día con su subtotal. El total
 * del presupuesto, que suma todos los días, se ve siempre abajo: un solo presupuesto, un solo total y
 * una sola seña.
 */
export function PresupuestoPorDia({
  evento,
  presupuesto,
  indice,
  onVerPresupuesto,
  onImprimirComanda,
}: {
  evento: EventoDetallado;
  presupuesto: Presupuesto;
  // El día que está mirando el selector, que vive arriba de las observaciones.
  indice: number;
  onVerPresupuesto?: (presupuestoId: number) => void;
  onImprimirComanda?: (presupuestoId: number) => void;
}) {
  const cantidad = evento.dias.length;
  // Si el evento cambia de largo (se achicó la franja) no se queda parado en un día que ya no existe.
  const dia = evento.dias[Math.min(indice, cantidad - 1)]!;

  const lineasDelDia = presupuesto.lineas.filter(
    (linea) => (linea as { diaId?: number }).diaId === dia.id,
  );
  const subtotal = lineasDelDia.reduce((suma, linea) => suma + Number(linea.subtotal), 0);
  const hayACotizar = lineasDelDia.some((linea) => linea.aCotizar);

  return (
    <>
      <CardHeader className="flex items-baseline justify-between gap-2">
        <CardTitle>Presupuesto ({presupuesto.estado})</CardTitle>
        <span className="text-xs text-muted-foreground">
          {presupuesto.lineas.length} {presupuesto.lineas.length === 1 ? 'ítem' : 'ítems'} ·{' '}
          {cantidad} días
        </span>
      </CardHeader>
      <CardContent>
        {lineasDelDia.length > 0 ? (
          <ul className="divide-y text-sm">
            {lineasDelDia.map((linea) => (
              <li key={linea.id} className="flex justify-between gap-4 py-1.5">
                <span className="min-w-0">
                  {linea.descripcion}{' '}
                  <span className="text-muted-foreground">
                    ×{linea.cantidad}
                    {/* RN-11: continuo o en mesa, si el servicio la lleva. */}
                    {linea.modalidad !== 'Normal' && ` · ${textoModalidad(linea.modalidad)}`}
                    {/* La hora a la que se espera el servicio, si se pidió una. */}
                    {linea.horaEstimada && ` · ${linea.horaEstimada}`}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {linea.aCotizar ? 'A cotizar' : formateadorMoneda.format(Number(linea.subtotal))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            Este día no tiene ítems en el presupuesto.
          </p>
        )}
        <div className="flex justify-between gap-4 border-t py-2 text-sm font-medium">
          <span>Subtotal del día{hayACotizar && ' (sin lo a cotizar)'}</span>
          <span className="tabular-nums">{formateadorMoneda.format(subtotal)}</span>
        </div>

        {/* El total es el de todo el evento, no el del día: se ve en cualquier día. */}
        <div className="mt-2 flex items-center justify-between gap-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {onVerPresupuesto && (
              <Button variant="outline" size="sm" onClick={() => onVerPresupuesto(presupuesto.id)}>
                Ver detalle del presupuesto
              </Button>
            )}
            {/* Solo con el presupuesto confirmado: antes de la seña el evento todavía se puede caer y
                la cocina no tiene nada que preparar. */}
            {onImprimirComanda && presupuesto.estado === 'Confirmado' && (
              <Button variant="outline" size="sm" onClick={() => onImprimirComanda(presupuesto.id)}>
                <Printer /> Comanda de cocina
              </Button>
            )}
          </div>
          <p className="text-right">
            <span className="block text-xs text-muted-foreground">
              Total sin IVA · {cantidad} días
            </span>
            <span className="font-medium tabular-nums">
              {formateadorMoneda.format(Number(presupuesto.total))}
            </span>
          </p>
        </div>
      </CardContent>
    </>
  );
}
