import { type EventoDetallado, PORCENTAJE_SENA } from '@confluens/shared';
import { Ban, CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Cargando } from '@/components/PantallaDeCarga';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnularPago, usePagosDeEvento } from '@/hooks/use-pagos';
import { ErrorApiCliente } from '@/lib/api';
import { fechaLocal } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { rutaDelDiaEnLaAgenda } from './dia-en-la-agenda';

// Los pagos sí llevan centavos: a diferencia de formatearPesos (que redondea a pesos enteros para
// la landing), acá el importe es plata que entró y tiene que cuadrar hasta el último centavo.
const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

/**
 * HU-14: el estado de cuenta del evento (criterio 2), a la derecha de la pestaña Pagos: el saldo,
 * la seña y la lista de pagos, con la anulación (HU-35). El formulario de cobro va a la izquierda
 * (FormularioDePago): antes se abría en un diálogo desde un botón de esta tarjeta.
 *
 * La cuenta se lee de un vistazo: saldo grande y una barra con la marca de la seña.
 */
export function CuentaDelEvento({ evento }: { evento: EventoDetallado }) {
  const eventoId = evento.id;
  const cuenta = usePagosDeEvento(eventoId);
  const anularPago = useAnularPago(eventoId);
  // HU-35: el pago cuya anulación se está confirmando. Anular pide una confirmación explícita en la
  // misma fila antes de llamar a la API.
  const [pagoAAnular, setPagoAAnular] = useState<number | null>(null);
  // Si la última anulación sacó al evento de Cobrado: el detalle ya muestra el estado nuevo, pero se
  // avisa por qué cambió.
  const [volvioAConfirmado, setVolvioAConfirmado] = useState(false);

  if (cuenta.isLoading) {
    return <Cargando texto="Cargando la cuenta…" />;
  }
  if (cuenta.isError || !cuenta.data) {
    return <p className="text-sm text-destructive">No se pudo cargar la cuenta del evento.</p>;
  }

  const { pagos, saldo } = cuenta.data;
  const base = Number(saldo.baseDeCobro);
  // HU-21: el importe de la seña y si ya se alcanzó los calcula la API con Decimal (el 20% de la
  // base, redondeado para arriba al centavo). Acá solo se resta para mostrar cuánto falta.
  const montoSena = Number(saldo.montoSena);
  // Redondeado al centavo: la resta de dos number puede dejar 184058.00000000003.
  const faltaParaLaSena = saldo.senaAlcanzada
    ? 0
    : Number((montoSena - Number(saldo.pagado)).toFixed(2));
  const porcentajeAbonado = Math.min(100, Math.max(0, Number(saldo.porcentajeAbonado)));
  const saldoPendiente = Number(saldo.saldo);
  const enConsulta = evento.estado === 'EnConsulta';
  const cobrado = evento.estado === 'Cobrado';
  const cancelado = evento.estado === 'Cancelado';
  // Decisión del PO (16/10/2026): si el total bajó por debajo de lo pagado, la diferencia es un
  // saldo a favor del cliente, no un saldo pendiente con signo menos.
  const saldoAFavor = saldoPendiente < 0;
  // HU-35: una anulación puede dejar lo pagado por debajo de la seña. El evento sigue Reservado (no
  // vuelve a consulta), pero se avisa. Solo si hay un pago anulado: que el total haya subido después
  // de reservar no vuelve a pedir la seña (RN-09).
  const senaDescubierta =
    !enConsulta && !cancelado && !saldo.cubreSena && pagos.some((pago) => pago.anuladoEn);

  function confirmarAnulacion(pagoId: number) {
    anularPago.mutate(pagoId, {
      onSuccess: (resultadoAnulacion) =>
        setVolvioAConfirmado(cobrado && resultadoAnulacion.estadoEvento === 'Reservado'),
      onSettled: () => setPagoAAnular(null),
    });
  }

  return (
    <Card>
      {/* «Ver en la agenda» está siempre, en cualquier estado del evento: abre el calendario en
            el día del evento. Antes aparecía solo después del pago que reservaba el salón. */}
      <CardHeader>
        <CardTitle>Cuenta del evento</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link to={rutaDelDiaEnLaAgenda(evento)}>
              <CalendarDays /> Ver en la agenda
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Un evento cobrado no tiene saldo que mirar: lo que importa es cuánto entró y que
              ya está completo. Va en el azul con el que la agenda marca los eventos Cobrados, para
              que se lea de un vistazo sin tener que interpretar un $0 de saldo. */}
        {cobrado ? (
          <div className="rounded-xl bg-estado-cobrado px-4 py-3 text-crema">
            <p className="text-xs font-medium tracking-wide uppercase opacity-90">Evento cobrado</p>
            <p className="text-2xl font-semibold tabular-nums">{formateadorMoneda.format(base)}</p>
            <p className="text-xs opacity-90">
              Total cobrado por completo ({saldo.incluyeIva ? 'con IVA' : 'sin IVA'})
            </p>
          </div>
        ) : cancelado ? (
          // RN-06: lo abonado no se reintegra. La cuenta queda para consulta, sin cobro ni saldo
          // que perseguir: lo que importa es cuánto entró antes de la baja.
          <div className="rounded-xl bg-estado-cancelado-fondo px-4 py-3 text-estado-cancelado-texto">
            <p className="text-xs font-medium tracking-wide uppercase">Evento cancelado</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formateadorMoneda.format(Number(saldo.pagado))}
            </p>
            <p className="text-xs">
              Abonado antes de la baja, de una base de cobro de {formateadorMoneda.format(base)} (
              {saldo.incluyeIva ? 'con IVA' : 'sin IVA'}). Los pagos se conservan para consulta y no
              se reintegran.
            </p>
          </div>
        ) : (
          <div>
            <p
              className={cn('text-2xl font-semibold tabular-nums', saldoAFavor && 'text-amber-800')}
            >
              {formateadorMoneda.format(Math.abs(saldoPendiente))}
            </p>
            <p className="text-xs text-muted-foreground">
              {saldoAFavor ? 'Saldo a favor del cliente' : 'Saldo pendiente'} · base de cobro{' '}
              {formateadorMoneda.format(base)} ({saldo.incluyeIva ? 'con IVA' : 'sin IVA'})
            </p>
          </div>
        )}

        {/* Barra de lo abonado. Mientras el evento está en consulta lleva la marca de la seña: es
              el umbral que reserva el salón (HU-13). Con el evento cobrado o cancelado no aporta:
              el cartel de arriba ya dice cómo quedó. */}
        <div className={cn('space-y-1.5', (cobrado || cancelado) && 'hidden')}>
          <div
            className="relative h-2 rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentajeAbonado}
            aria-label="Porcentaje abonado"
          >
            <div
              className="h-full rounded-full bg-bordo transition-[width]"
              style={{ width: `${porcentajeAbonado}%` }}
            />
            {enConsulta && (
              <div
                className="absolute -top-1 h-4 border-l-2 border-dorado"
                style={{ left: `${PORCENTAJE_SENA}%` }}
                aria-hidden
              />
            )}
          </div>
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {porcentajeAbonado}% abonado · {formateadorMoneda.format(Number(saldo.pagado))}
            </span>
            {/* HU-21: la seña se ve en cualquier estado, con su importe y si ya se alcanzó. Si una
                  anulación la dejó sin cubrir (HU-35), no se la muestra como cubierta: el aviso de
                  abajo lo explica. */}
            <span
              className={
                saldo.senaAlcanzada && !senaDescubierta
                  ? 'text-estado-confirmado-texto'
                  : 'text-estado-consulta-texto'
              }
            >
              Seña {PORCENTAJE_SENA}%: {formateadorMoneda.format(montoSena)}
              {saldo.senaAlcanzada && !senaDescubierta && ' · cubierta'}
            </span>
          </div>
        </div>

        {/* RN-01: la base incluye el IVA solo si el presupuesto se factura, así que la seña del
              20% cambia de monto según eso. Por eso se aclara sobre qué se calculó. */}
        {/* Una vez reservado, la seña ya se cobró aunque después suba el total (RN-09): no se
              vuelve a pedir el 20%, se cobra el saldo. Con la seña descubierta por una anulación
              (HU-35) el texto lo reemplaza el aviso de abajo. */}
        <p
          className={cn(
            'text-xs text-muted-foreground',
            (cobrado || cancelado || senaDescubierta) && 'hidden',
          )}
        >
          {enConsulta
            ? faltaParaLaSena > 0
              ? `Faltan ${formateadorMoneda.format(faltaParaLaSena)} para la seña y reservar el salón.`
              : 'La seña ya está cubierta.'
            : saldoAFavor
              ? 'Lo pagado supera el total: hay que resolver la diferencia con el cliente.'
              : 'La seña ya se cobró y el salón está reservado.'}
        </p>

        {/* HU-35: sin transición a consulta, el evento sigue confirmado aunque lo pagado ya no
              cubra la seña (reunión 05/11/2026). */}
        {senaDescubierta && (
          <p className="rounded-lg border border-estado-consulta-borde bg-estado-consulta-fondo p-3 text-sm text-estado-consulta-texto">
            Lo pagado no cubre la seña ({formateadorMoneda.format(montoSena)}) por un pago anulado.
            El evento sigue confirmado.
          </p>
        )}
        {anularPago.isSuccess && (
          <p className="text-sm text-emerald-800">
            Pago anulado.
            {volvioAConfirmado && ' El evento volvió a confirmado hasta cobrar la diferencia.'}
          </p>
        )}
        {anularPago.isError && (
          <p className="text-sm text-destructive">
            {anularPago.error instanceof ErrorApiCliente
              ? anularPago.error.message
              : 'No se pudo anular el pago.'}
          </p>
        )}

        <div className="border-t pt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Pagos</p>
          {pagos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Todavía no hay pagos.</p>
          ) : (
            <ul className="divide-y">
              {pagos.map((pago) => {
                // HU-21: el pago que completó la seña y el que completó el total se destacan con
                // el color del estado al que llevaron el evento, el mismo de la agenda: verde de
                // Confirmado y azul de Cobrado. Si un solo pago hizo las dos cosas, la fila va en
                // azul, que es como quedó el evento, y lleva las dos etiquetas.
                const hitos = [
                  pago.completaSena && { texto: 'Seña completa', clase: 'bg-estado-confirmado' },
                  pago.completaPago && {
                    texto: 'Evento con pago completo',
                    clase: 'bg-estado-cobrado',
                  },
                ].filter((hito): hito is { texto: string; clase: string } => Boolean(hito));
                const destacado = hitos.length > 0;
                // HU-35: el pago anulado sigue en la lista, apagado y tachado, con quién lo anuló
                // y cuándo. No suma a lo pagado. Los de un evento cancelado no se anulan.
                const anulado = pago.anuladoEn !== null;
                const confirmando = pagoAAnular === pago.id;
                return (
                  <li
                    key={pago.id}
                    className={cn(
                      'py-2',
                      anulado && 'text-muted-foreground',
                      destacado && 'my-1 rounded-lg border px-2.5',
                      pago.completaPago
                        ? 'border-estado-cobrado-borde bg-estado-cobrado-fondo text-estado-cobrado-texto'
                        : pago.completaSena &&
                            'border-estado-confirmado-borde bg-estado-confirmado-fondo text-estado-confirmado-texto',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        {fechaLocal(pago.fecha).toLocaleDateString('es-AR')} ·{' '}
                        {pago.medioPago.nombre}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={cn('font-medium tabular-nums', anulado && 'line-through')}>
                          {formateadorMoneda.format(Number(pago.monto))}
                        </span>
                        {!anulado && !cancelado && !confirmando && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Anular pago"
                            title="Anular pago"
                            onClick={() => {
                              anularPago.reset();
                              setPagoAAnular(pago.id);
                            }}
                          >
                            <Ban />
                          </Button>
                        )}
                      </span>
                    </div>
                    {anulado && (
                      <p className="mt-0.5 text-xs">
                        <span className="font-medium">Anulado</span>
                        {pago.anuladoEn &&
                          ` el ${new Date(pago.anuladoEn).toLocaleDateString('es-AR')}`}
                        {pago.anuladoPor && ` por ${pago.anuladoPor.email}`}. No suma a lo pagado.
                      </p>
                    )}
                    {confirmando && (
                      <div className="mt-2 space-y-2 rounded-lg border border-destructive/40 p-2.5 text-xs">
                        <p>
                          ¿Anular este pago? Queda en la cuenta como anulado y deja de sumar a lo
                          pagado. Para corregirlo o pasarlo a otro evento, después se registra de
                          nuevo.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={anularPago.isPending}
                            onClick={() => confirmarAnulacion(pago.id)}
                          >
                            {anularPago.isPending ? 'Anulando…' : 'Sí, anular'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={anularPago.isPending}
                            onClick={() => setPagoAAnular(null)}
                          >
                            No
                          </Button>
                        </div>
                      </div>
                    )}
                    {destacado && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {hitos.map((hito) => (
                          <span
                            key={hito.texto}
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium text-crema',
                              hito.clase,
                            )}
                          >
                            {hito.texto}
                          </span>
                        ))}
                      </div>
                    )}
                    {pago.observacion && (
                      <p
                        className={cn(
                          'text-xs',
                          destacado ? 'mt-1 opacity-80' : 'text-muted-foreground',
                        )}
                      >
                        {pago.observacion}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
