import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCancelarEvento, useEvento } from '@/hooks/use-eventos';
import { ErrorApiCliente } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CuentaDelEvento } from './CuentaDelEvento';
import { ESTADOS } from './estado-evento';

const formateadorFecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

interface DetalleEventoProps {
  eventoId: number;
  // HU-11: abre el detalle completo del presupuesto (líneas, IVA, vigencia y los demás del evento).
  onVerPresupuesto?: (presupuestoId: number) => void;
}

// Vista central del evento: datos, presupuesto, cuenta y cancelación (criterio 5 / RN-07). No hay
// un paso aparte para agendar: la distribución y el horario se cargan en el mismo formulario del
// pago (CuentaDelEvento), que agenda y cobra de una vez. El evento sigue EnConsulta hasta que los
// pagos cruzan el 20% de la base de cobro (HU-13).
export function DetalleEvento({ eventoId, onVerPresupuesto }: DetalleEventoProps) {
  const { data: evento, isLoading, isError } = useEvento(eventoId);
  const cancelarEvento = useCancelarEvento(eventoId);

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (isError || !evento) {
    return <p className="p-6 text-sm text-destructive">No se pudo cargar el evento.</p>;
  }

  const presupuestoVigente =
    evento.presupuestos.find((p) => p.estado === 'Confirmado') ??
    evento.presupuestos.find((p) => p.estado === 'Estimado') ??
    evento.presupuestos[0];
  const total = presupuestoVigente ? Number(presupuestoVigente.total) : 0;

  const estado = ESTADOS[evento.estado];

  function manejarCancelacion() {
    if (!window.confirm('¿Cancelar este evento? Esta acción no se puede deshacer.')) return;
    cancelarEvento.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Evento #{evento.id}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado:{' '}
          <span
            title={estado.ayuda}
            className={cn('rounded-full px-2 py-0.5 text-xs font-medium', estado.clase)}
          >
            {estado.etiqueta}
          </span>
        </p>
        <BadgeTipoEvento evento={evento} className="mt-2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente y salón</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Cliente: </span>
            {evento.cliente.nombre} · {evento.cliente.telefono} · {evento.cliente.correo}
          </p>
          <p>
            <span className="text-muted-foreground">Salón: </span>
            {evento.salon?.nombre ?? 'A definir'} · {evento.cantidadPersonas} personas
          </p>
          {evento.solicitud && (
            <p className="text-muted-foreground">
              Consulta original enviada el{' '}
              {formateadorFecha.format(new Date(evento.solicitud.creadoEn))}
            </p>
          )}
        </CardContent>
      </Card>

      {presupuestoVigente && (
        <Card>
          <CardHeader>
            <CardTitle>Presupuesto ({presupuestoVigente.estado})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {presupuestoVigente.lineas.map((linea) => (
                <li key={linea.id} className="flex justify-between py-1.5">
                  <span>
                    {linea.descripcion} ×{linea.cantidad}
                  </span>
                  <span>
                    {linea.aCotizar
                      ? 'A cotizar'
                      : formateadorMoneda.format(Number(linea.subtotal))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between font-medium">
              <span>Total (sin IVA)</span>
              <span>{formateadorMoneda.format(total)}</span>
            </p>
            {onVerPresupuesto && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => onVerPresupuesto(presupuestoVigente.id)}
              >
                Ver detalle del presupuesto
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* HU-14: el saldo, el formulario de cobro y el historial. Sin presupuesto no hay base de
          cobro contra la que medir nada, así que no hay cuenta que mostrar. */}
      {presupuestoVigente && (
        <CuentaDelEvento
          evento={evento}
          admitePagos={evento.estado !== 'Cancelado' && evento.estado !== 'Cobrado'}
        />
      )}

      {evento.estado === 'Reservado' && (
        <Card>
          <CardHeader>
            <CardTitle>Reserva</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {evento.senaRegistradaEn && (
              <p className="text-muted-foreground">
                El salón quedó reservado el{' '}
                {formateadorFecha.format(new Date(evento.senaRegistradaEn))}, cuando los pagos
                alcanzaron la seña.
              </p>
            )}

            {cancelarEvento.isError && (
              <p className="text-sm text-destructive">
                {cancelarEvento.error instanceof ErrorApiCliente
                  ? cancelarEvento.error.message
                  : 'No se pudo cancelar el evento.'}
              </p>
            )}
            <Button
              variant="destructive"
              disabled={cancelarEvento.isPending}
              onClick={manejarCancelacion}
            >
              Cancelar evento
            </Button>
          </CardContent>
        </Card>
      )}

      {(evento.estado === 'Cancelado' || evento.estado === 'Cobrado') && (
        <p className="text-sm text-muted-foreground">
          Este evento está {evento.estado === 'Cancelado' ? 'cancelado' : 'cobrado'}, no admite más
          acciones.
        </p>
      )}
    </div>
  );
}
