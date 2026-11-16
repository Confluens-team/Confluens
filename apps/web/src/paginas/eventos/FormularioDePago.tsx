import {
  compararMediosPago,
  type CrearPago,
  esquemaCrearPago,
  type EventoDetallado,
  hoyEnZonaEventos,
  PORCENTAJE_SENA,
} from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';

import { InputImporte } from '@/components/InputImporte';
import { SelectorFecha } from '@/components/SelectorFechaHora';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAgendarEvento } from '@/hooks/use-eventos';
import { useMediosPago, usePagosDeEvento, useRegistrarPago } from '@/hooks/use-pagos';
import { ErrorApiCliente } from '@/lib/api';
import { nombreCompleto } from '@/lib/formato';
import { CLASES_SELECT } from './clases-select';
import { rutaDelDiaEnLaAgenda } from './dia-en-la-agenda';
import { useHorarioDelEvento } from './use-horario-del-evento';

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
 * con la cuenta a la derecha. Se monta al entrar a la pestaña: cada vez arranca con el horario
 * guardado, como el diálogo al abrirse.
 *
 * Registrar un pago puede cambiarle el estado al evento: al cruzar el 20% de la base de cobro se
 * confirma el presupuesto y se reserva el salón (HU-13), y al 100% el evento pasa a Cobrado. Con el
 * evento en consulta, agendar va en el mismo formulario (ADR 0007: sin distribución y horario no se
 * puede reservar el salón).
 */
export function FormularioDePago({ evento }: { evento: EventoDetallado }) {
  const cuenta = usePagosDeEvento(evento.id);
  const mediosPago = useMediosPago();
  const registrarPago = useRegistrarPago(evento.id);
  const agendarEvento = useAgendarEvento(evento.id);
  const horario = useHorarioDelEvento(evento);

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

  async function registrar(datos: CrearPago) {
    // Primero se agenda (si hay algo nuevo que agendar) y después se cobra: el pago que cruza la
    // seña necesita el horario ya guardado para evaluar RN-12. Si agendar falla, no se cobra.
    if (enConsulta && horario.completo && horario.cambio) {
      try {
        await agendarEvento.mutateAsync(horario.datos());
      } catch {
        return;
      }
    }
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

  if (cuenta.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
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
  const errorAgendar =
    agendarEvento.isError &&
    (agendarEvento.error instanceof ErrorApiCliente
      ? agendarEvento.error.message
      : 'No se pudo guardar el horario del evento.');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{enConsulta ? 'Agendar y registrar pago' : 'Registrar pago'}</CardTitle>
        <CardDescription>
          {enConsulta
            ? `Si el pago llega a la seña (${formateadorMoneda.format(montoSena)}), el presupuesto se confirma y el salón queda reservado.`
            : `Saldo pendiente: ${formateadorMoneda.format(saldoPendiente)}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(registrar)} className="space-y-5">
          {enConsulta && evento.salones.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Para reservar el salón con la seña, primero elegí el salón en el detalle de la
              consulta y guardá los cambios.
            </p>
          )}
          {enConsulta && evento.salones.length > 0 && (
            <fieldset className="space-y-4">
              <legend className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Horario
              </legend>
              {horario.campos}
              {!horario.completo && faltaParaLaSena > 0 && (
                <p className="text-xs text-muted-foreground">
                  Para que el pago que llega al {PORCENTAJE_SENA}% reserve el salón, completá
                  distribución, hora de inicio y hora de fin.
                </p>
              )}
            </fieldset>
          )}

          <fieldset className="space-y-4">
            {enConsulta && (
              <legend className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Pago
              </legend>
            )}
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

          {enConsulta && errorAgendar && (
            <p className="text-sm whitespace-pre-line text-destructive">{errorAgendar}</p>
          )}
          {registrarPago.isError && (
            <p className="text-sm whitespace-pre-line text-destructive">
              {registrarPago.error instanceof ErrorApiCliente
                ? registrarPago.error.message
                : 'No se pudo registrar el pago.'}
            </p>
          )}

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={registrarPago.isPending || agendarEvento.isPending}>
              {registrarPago.isPending || agendarEvento.isPending
                ? 'Registrando…'
                : 'Registrar pago'}
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
