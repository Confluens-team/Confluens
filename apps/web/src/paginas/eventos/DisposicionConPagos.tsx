import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvento } from '@/hooks/use-eventos';
import { CuentaDelEvento } from './CuentaDelEvento';
import { FormularioDePago } from './FormularioDePago';
import { presupuestoVigenteDe } from './presupuesto-vigente';

/**
 * El cuerpo de la consulta y del evento debajo del título (15/11/2026): los datos del cliente fijos
 * arriba y, debajo, lo de la pestaña elegida.
 *
 * - **Detalle:** lo que pasa la pantalla (`children`), a todo el ancho.
 * - **Pagos:** a la izquierda el cliente y el formulario para cargar un pago nuevo; a la derecha el
 *   seguimiento de la cuenta (el estado, lo pagado y lo que falta). La pestaña reemplaza al botón
 *   «Registrar pago», y el formulario va en el lugar del detalle para no repetirlo.
 *
 * La tarjeta del cliente es una sola en las dos pestañas (no se vuelve a montar), y el detalle se
 * oculta sin desmontarse: lo que se estaba editando no se pierde al ir a Pagos y volver.
 */
export function DisposicionConPagos({
  eventoId,
  pagos,
  cliente,
  children,
  accionSinPresupuesto,
}: {
  eventoId: number;
  // Si la pestaña elegida es Pagos.
  pagos: boolean;
  cliente: React.ReactNode;
  // Lo de la pestaña Detalle.
  children: React.ReactNode;
  // Lo que se ofrece cuando el evento todavía no tiene presupuesto contra el que cobrar.
  accionSinPresupuesto?: React.ReactNode;
}) {
  const { data: evento, isError } = useEvento(eventoId);
  const presupuesto = evento && presupuestoVigenteDe(evento);
  const sinArmar = presupuesto?.venceEn === null;
  const conCuenta = pagos && !!evento && !!presupuesto && !sinArmar;
  const admitePagos = evento?.estado !== 'Cancelado' && evento?.estado !== 'Cobrado';

  let formulario: React.ReactNode;
  if (!evento) {
    formulario = isError ? (
      <p className="text-sm text-destructive">No se pudo cargar la cuenta del evento.</p>
    ) : (
      <p className="text-sm text-muted-foreground">Cargando la cuenta…</p>
    );
  } else if (!presupuesto || sinArmar) {
    formulario = (
      <Card>
        <CardHeader>
          <CardTitle>{sinArmar ? 'Presupuesto sin armar' : 'Sin presupuesto'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {sinArmar
              ? 'El presupuesto todavía no tiene nada cargado, así que no hay base de cobro que calcular. Armalo y guardalo en Detalle.'
              : 'El evento no tiene ningún presupuesto asociado al que calcularle una base de cobro.'}
          </p>
          {accionSinPresupuesto}
        </CardContent>
      </Card>
    );
  } else if (admitePagos) {
    // Se monta al entrar a la pestaña: arranca con el horario guardado, como el diálogo de antes.
    formulario = <FormularioDePago evento={evento} />;
  } else {
    formulario = (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Este evento está {evento.estado === 'Cancelado' ? 'cancelado' : 'cobrado'}: no admite más
          pagos. A la derecha queda la cuenta para consulta.
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={
        conCuenta
          ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start'
          : 'space-y-4'
      }
    >
      <div className="min-w-0 space-y-4">
        {cliente}
        <div className={pagos ? 'hidden' : undefined}>{children}</div>
        {pagos && formulario}
      </div>
      {conCuenta && (
        <aside aria-label="Cuenta del evento" className="min-w-0 lg:sticky lg:top-4">
          <CuentaDelEvento evento={evento} />
        </aside>
      )}
    </div>
  );
}
