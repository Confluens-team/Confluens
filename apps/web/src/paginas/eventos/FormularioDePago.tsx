import {
  compararMediosPago,
  type CrearPago,
  esquemaCrearPago,
  type EventoDetallado,
  hoyEnZonaEventos,
} from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';

import { InputImporte } from '@/components/InputImporte';
import { Cargando } from '@/components/PantallaDeCarga';
import { SelectorFecha } from '@/components/SelectorFechaHora';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMediosPago, usePagosDeEvento, useRegistrarPago } from '@/hooks/use-pagos';
import { ErrorApiCliente } from '@/lib/api';
import { nombreCompleto } from '@/lib/formato';
import { CLASES_SELECT } from './clases-select';
import { rutaDelDiaEnLaAgenda } from './dia-en-la-agenda';

// Los pagos sí llevan centavos: el importe es plata que entró y tiene que cuadrar hasta el centavo.
const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const formateadorHorario = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
});

/**
 * HU-14: el formulario de cobro, a la izquierda de la pestaña Pagos (15/11/2026). Antes se abría en
 * un diálogo desde «Registrar pago»; ahora la pestaña es ese botón y el formulario queda a la vista,
 * con la cuenta a la derecha. Pide solo el cobro: monto, fecha, medio de pago y una observación. El
 * horario y la distribución de cada día se cargan en Detalle (15/11/2026).
 *
 * Registrar un pago puede cambiarle el estado al evento: al cruzar el 20% de la base de cobro se
 * confirma el presupuesto y se reserva el salón (HU-13), y al 100% el evento pasa a Cobrado. Sin
 * horario y distribución el salón no se puede reservar (ADR 0007): la API rechaza ese pago.
 */
export function FormularioDePago({ evento }: { evento: EventoDetallado }) {
  const cuenta = usePagosDeEvento(evento.id);
  const mediosPago = useMediosPago();
  const registrarPago = useRegistrarPago(evento.id);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<CrearPago>({
    resolver: zodResolver(esquemaCrearPago),
    // El pago se propone con la fecha de hoy, en la zona de los eventos (ADR 0010).
    defaultValues: { fecha: hoyEnZonaEventos(), monto: '' },
  });
  const fechaPago = useWatch({ control, name: 'fecha' });
  const enConsulta = evento.estado === 'EnConsulta';

  function registrar(datos: CrearPago) {
    registrarPago.mutate(datos, {
      // El medio de pago queda elegido: lo habitual es cargar varias entregas por el mismo medio.
      // El resto se nombra de a uno (incluida la observación, que vale ''): reset() solo limpia lo
      // que recibe en el objeto.
      onSuccess: () =>
        reset({
          fecha: hoyEnZonaEventos(),
          monto: '',
          observacion: '',
          medioPagoId: datos.medioPagoId,
        }),
    });
  }

  if (cuenta.isLoading) return <Cargando texto="Cargando…" />;
  if (cuenta.isError || !cuenta.data) {
    return <p className="text-sm text-destructive">No se pudo cargar la cuenta del evento.</p>;
  }

  const { saldo } = cuenta.data;
  // RN-14 desde HU-53: todos los medios activos se pueden usar en cualquier cobro.
  const mediosHabilitados = [...(mediosPago.data ?? [])].sort(compararMediosPago);
  const montoSena = Number(saldo.montoSena);
  // Redondeado al centavo: la resta de dos number puede dejar 184058.00000000003.
  const faltaParaLaSena = saldo.senaAlcanzada
    ? 0
    : Number((montoSena - Number(saldo.pagado)).toFixed(2));
  const saldoPendiente = Number(saldo.saldo);
  const resultado = registrarPago.data;
  // Sin horario o sin distribución en algún día, el pago que llega a la seña no puede reservar.
  const sinAgendar =
    enConsulta &&
    evento.dias.some(
      (dia) => !dia.inicio || !dia.fin || dia.salones.some((salon) => !salon.distribucion),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar pago</CardTitle>
        {!enConsulta && (
          <CardDescription>
            Saldo pendiente: {formateadorMoneda.format(saldoPendiente)}.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(registrar)} className="space-y-5">
          {sinAgendar && faltaParaLaSena > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Falta el horario o la distribución de algún día: cargalos en Detalle y guardá.
            </p>
          )}
          <fieldset className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="monto">Monto</Label>
                <InputImporte id="monto" placeholder="0.00" {...register('monto')} />
                {errors.monto && <p className="text-xs text-destructive">{errors.monto.message}</p>}
                {enConsulta && faltaParaLaSena > 0 && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() =>
                      setValue('monto', faltaParaLaSena.toFixed(2), { shouldValidate: true })
                    }
                  >
                    Cargar la seña ({formateadorMoneda.format(faltaParaLaSena)})
                  </Button>
                )}
                {!enConsulta && saldoPendiente > 0 && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() =>
                      setValue('monto', saldoPendiente.toFixed(2), { shouldValidate: true })
                    }
                  >
                    Cargar el saldo ({formateadorMoneda.format(saldoPendiente)})
                  </Button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha</Label>
                <SelectorFecha
                  id="fecha"
                  value={fechaPago ?? ''}
                  onChange={(dia) => setValue('fecha', dia, { shouldValidate: true })}
                />
                {errors.fecha && <p className="text-xs text-destructive">{errors.fecha.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="medioPagoId">Medio de pago</Label>
              <select
                id="medioPagoId"
                className={CLASES_SELECT}
                defaultValue=""
                // El <select> nativo siempre devuelve string; el contrato pide el id numérico.
                {...register('medioPagoId', { setValueAs: (valor) => Number(valor) })}
              >
                <option value="" disabled>
                  Elegir…
                </option>
                {mediosHabilitados.map((medio) => (
                  <option key={medio.id} value={medio.id}>
                    {medio.nombre}
                  </option>
                ))}
              </select>
              {errors.medioPagoId && (
                <p className="text-xs text-destructive">Elegí un medio de pago.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacion">Observación (opcional)</Label>
              <Textarea
                id="observacion"
                rows={2}
                // Un textarea vacío manda "": el campo es opcional, así que no viaja.
                {...register('observacion', {
                  setValueAs: (valor: string) => valor.trim() || undefined,
                })}
              />
              {errors.observacion && (
                <p className="text-xs text-destructive">{errors.observacion.message}</p>
              )}
            </div>
          </fieldset>

          {registrarPago.isError && (
            <p className="text-sm whitespace-pre-line text-destructive">
              {registrarPago.error instanceof ErrorApiCliente
                ? registrarPago.error.message
                : 'No se pudo registrar el pago.'}
            </p>
          )}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={registrarPago.isPending}>
              {registrarPago.isPending ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </div>
        </form>

        {resultado?.reservoElSalon && (
          <div className="mt-4 space-y-2 rounded-lg border border-estado-confirmado-borde bg-estado-confirmado-fondo p-3 text-sm text-estado-confirmado-texto">
            <p className="font-medium">
              Con este pago se alcanzó la seña: el presupuesto quedó confirmado y el salón
              reservado.{' '}
              <Link to={rutaDelDiaEnLaAgenda(evento)} className="underline underline-offset-2">
                Ver en la agenda
              </Link>
            </p>
            {/* HU-13 C6: las consultas que pisan la franja NO se cancelan (Cancelado es siempre
                manual, dominio.md:30). Se avisan para que las gestione una persona. */}
            {resultado.consultasEnConflicto.length > 0 && (
              <div>
                <p>
                  {resultado.consultasEnConflicto.length === 1
                    ? 'Quedó 1 consulta pisando ese horario. No se canceló: hay que avisarle.'
                    : `Quedaron ${resultado.consultasEnConflicto.length} consultas pisando ese horario. No se cancelaron: hay que avisarles.`}
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {resultado.consultasEnConflicto.map((consulta) => (
                    <li key={consulta.id}>
                      Evento #{consulta.id} · {nombreCompleto(consulta.cliente)}
                      {consulta.inicio &&
                        ` · ${formateadorHorario.format(new Date(consulta.inicio))}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {registrarPago.isSuccess && !resultado?.reservoElSalon && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" /> Pago registrado.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
