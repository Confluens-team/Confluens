import { type CrearPago, esquemaCrearPago, PORCENTAJE_SENA } from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMediosPago, usePagosDeEvento, useRegistrarPago } from '@/hooks/use-pagos';
import { ErrorApiCliente } from '@/lib/api';
import { fechaLocal, hoyISO, nombreCompleto } from '@/lib/formato';

// Los pagos sí llevan centavos: a diferencia de formatearPesos (que redondea a pesos enteros para
// la landing), acá el importe es plata que entró y tiene que cuadrar hasta el último centavo.
const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const formateadorHorario = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Clases del <input> de components/ui: no hay un <Select> en el proyecto (shadcn trae uno con
// radix, pero el catálogo son 3 opciones y el nativo ya da teclado, lector de pantalla y el
// selector del celular, igual que el de países en AccesoCliente.tsx).
const CLASES_SELECT =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30';

interface CuentaDelEventoProps {
  eventoId: number;
  // Un evento Cancelado o Cobrado no admite más pagos (el servicio los rechaza con 409): se muestra
  // la cuenta de solo lectura.
  admitePagos: boolean;
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <p className="flex justify-between">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="font-medium">{children}</span>
    </p>
  );
}

/**
 * HU-14 completa: el estado de cuenta del evento (criterio 2) y el formulario de cobro. Registrar
 * un pago puede cambiarle el estado al evento como efecto, no como acción aparte: al cruzar el 20%
 * de la base de cobro se confirma el presupuesto y se reserva el salón (HU-13), y al 100% el evento
 * pasa a Cobrado. De ahí el aviso de abajo del formulario: el pago que reserva el salón es el único
 * momento en que hace falta contar las consultas que quedaron pisando la franja. El paso a Cobrado
 * se ve solo: `admitePagos` se apaga y la tarjeta de cobro desaparece.
 */
export function CuentaDelEvento({ eventoId, admitePagos }: CuentaDelEventoProps) {
  const cuenta = usePagosDeEvento(eventoId);
  const mediosPago = useMediosPago();
  const registrarPago = useRegistrarPago(eventoId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CrearPago>({
    resolver: zodResolver(esquemaCrearPago),
    defaultValues: { fecha: hoyISO(), monto: '' },
  });

  function registrar(datos: CrearPago) {
    registrarPago.mutate(datos, {
      // El medio de pago queda elegido: lo habitual es cargar varias entregas por el mismo medio.
      // El resto de los campos se nombran de a uno (incluida la observación, que vale ''): reset()
      // solo limpia lo que recibe en el objeto.
      onSuccess: () =>
        reset({
          fecha: hoyISO(),
          monto: '',
          observacion: '',
          medioPagoId: datos.medioPagoId,
        }),
    });
  }

  if (cuenta.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando la cuenta…</p>;
  }
  if (cuenta.isError || !cuenta.data) {
    return <p className="text-sm text-destructive">No se pudo cargar la cuenta del evento.</p>;
  }

  const { pagos, saldo } = cuenta.data;
  const base = Number(saldo.baseDeCobro);
  // Presentación: cuánto falta para que el pago reserve el salón. La cuenta exacta la hace la API
  // con Decimal; acá es un número para mostrar, como el desglose de IVA.
  //
  // Se redondea para ARRIBA al centavo porque la base con IVA casi nunca da un 20% exacto (RN-01:
  // 576.487,56 × 20% = 115.297,512) y nadie puede entregar fracciones de centavo. Redondear para
  // abajo haría que la pantalla diga "ya está cubierta" con un pago que la API todavía considera
  // por debajo del umbral, y el salón no quedaría reservado.
  const montoSena = Math.ceil(base * PORCENTAJE_SENA) / 100;
  const faltaParaLaSena = montoSena - Number(saldo.pagado);
  const resultado = registrarPago.data;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Cuenta del evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Fila etiqueta={`Base de cobro (${saldo.incluyeIva ? 'con IVA' : 'sin IVA'})`}>
            {formateadorMoneda.format(base)}
          </Fila>
          <Fila etiqueta="Pagado">{formateadorMoneda.format(Number(saldo.pagado))}</Fila>
          <Fila etiqueta="Saldo">{formateadorMoneda.format(Number(saldo.saldo))}</Fila>
          <Fila etiqueta="Abonado">{saldo.porcentajeAbonado}%</Fila>

          {/* RN-01: la base incluye el IVA solo si el presupuesto se factura, así que la seña del
              20% cambia de monto según eso. Por eso se aclara sobre qué se calculó. */}
          <p className="pt-2 text-xs text-muted-foreground">
            La seña del {PORCENTAJE_SENA}% de esta base es {formateadorMoneda.format(montoSena)}
            {faltaParaLaSena > 0
              ? `: faltan ${formateadorMoneda.format(faltaParaLaSena)} para reservar el salón.`
              : ': ya está cubierta.'}
          </p>
        </CardContent>
      </Card>

      {admitePagos && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar pago</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(registrar)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input id="fecha" type="date" {...register('fecha')} />
                  {errors.fecha && (
                    <p className="text-xs text-destructive">{errors.fecha.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="monto">Monto</Label>
                  <Input
                    id="monto"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register('monto')}
                  />
                  {errors.monto && (
                    <p className="text-xs text-destructive">{errors.monto.message}</p>
                  )}
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
                    {(mediosPago.data ?? []).map((medio) => (
                      <option key={medio.id} value={medio.id}>
                        {medio.nombre}
                      </option>
                    ))}
                  </select>
                  {errors.medioPagoId && (
                    <p className="text-xs text-destructive">Elegí un medio de pago.</p>
                  )}
                </div>
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

              {registrarPago.isError && (
                <p className="text-sm text-destructive">
                  {registrarPago.error instanceof ErrorApiCliente
                    ? registrarPago.error.message
                    : 'No se pudo registrar el pago.'}
                </p>
              )}

              <Button type="submit" disabled={registrarPago.isPending} className="w-full">
                {registrarPago.isPending ? 'Registrando…' : 'Registrar pago'}
              </Button>
            </form>

            {resultado?.reservoElSalon && (
              <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-medium">
                  Con este pago se alcanzó la seña: el presupuesto quedó confirmado y el salón
                  reservado.
                </p>
                {/* HU-13 C6: las consultas que pisan la franja NO se cancelan (Cancelado es
                    siempre manual, dominio.md:30). Se avisan para que las gestione una persona. */}
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
          </CardContent>
        </Card>
      )}

      {pagos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historial de pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {pagos.map((pago) => (
                <li key={pago.id} className="py-2">
                  <div className="flex justify-between">
                    <span>
                      {fechaLocal(pago.fecha).toLocaleDateString('es-AR')} · {pago.medioPago.nombre}
                    </span>
                    <span className="font-medium">
                      {formateadorMoneda.format(Number(pago.monto))}
                    </span>
                  </div>
                  {pago.observacion && (
                    <p className="text-xs text-muted-foreground">{pago.observacion}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
