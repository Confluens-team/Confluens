import {
  type CrearPago,
  esquemaCrearPago,
  type EventoDetallado,
  PORCENTAJE_SENA,
  type TipoJornada,
} from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';

import { SelectorFechaHora } from '@/components/SelectorFechaHora';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAgendarEvento } from '@/hooks/use-eventos';
import { useMediosPago, usePagosDeEvento, useRegistrarPago } from '@/hooks/use-pagos';
import { useSalones } from '@/hooks/use-salones';
import { ErrorApiCliente } from '@/lib/api';
import { fechaLocal, nombreCompleto } from '@/lib/formato';
import { CLASES_SELECT } from './clases-select';

// Los pagos sí llevan centavos: a diferencia de formatearPesos (que redondea a pesos enteros para
// la landing), acá el importe es plata que entró y tiene que cuadrar hasta el último centavo.
const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const formateadorHorario = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface CuentaDelEventoProps {
  evento: EventoDetallado;
  // Un evento Cancelado o Cobrado no admite más pagos (el servicio los rechaza con 409): se muestra
  // la cuenta de solo lectura.
  admitePagos: boolean;
}

// Un instante ISO como valor de <input type="datetime-local">, en la hora de quien lo mira.
function comoFechaHoraLocal(iso: string): string {
  const fecha = new Date(iso);
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

// Duración con la que se propone el fin a partir del inicio. Media jornada: 4 h, el máximo que
// admite (dominio.md: "hasta 4 horas inclusive"). Jornada completa: dominio.md solo dice "más de
// 4 horas"; se proponen 8 h por decisión de Franco (08/10/2026). Es una sugerencia: el fin se
// puede cambiar a mano.
const HORAS_POR_JORNADA: Record<TipoJornada, number> = { media: 4, completa: 8 };

// La jornada que eligió el cliente. Los eventos anteriores a tipoJornada no la tienen guardada:
// sale de la línea del salón del presupuesto, que es la primera ("Salón X (media jornada)").
function jornadaDelEvento(evento: EventoDetallado): TipoJornada {
  if (evento.tipoJornada) return evento.tipoJornada;
  const presupuesto = evento.presupuestos.find((p) => p.estado !== 'Cancelado');
  return presupuesto?.lineas[0]?.descripcion.endsWith('(media jornada)') ? 'media' : 'completa';
}

// "YYYY-MM-DDTHH:mm" + horas, en la hora local (puede pasar al día siguiente).
function sumarHoras(valor: string, horas: number): string {
  const fecha = new Date(valor);
  fecha.setHours(fecha.getHours() + horas);
  return comoFechaHoraLocal(fecha.toISOString());
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
export function CuentaDelEvento({ evento, admitePagos }: CuentaDelEventoProps) {
  const eventoId = evento.id;
  const cuenta = usePagosDeEvento(eventoId);
  const mediosPago = useMediosPago();
  const registrarPago = useRegistrarPago(eventoId);
  const agendarEvento = useAgendarEvento(eventoId);
  const salones = useSalones();

  // `fecha` viaja como medianoche UTC del día del evento: el día es la parte YYYY-MM-DD, sin pasar
  // por Date (que lo correría al día anterior en Argentina). Es la fecha que se propone para el
  // pago, a pedido del Responsable de Eventos.
  const fechaDelEvento = evento.fecha.slice(0, 10);

  // Agendar va en el mismo formulario del pago (ADR 0007: sin distribución y horario no se puede
  // reservar el salón). Se precargan con lo ya agendado o, si no, el inicio con la hora estimada
  // de la consulta y el fin calculado según la jornada.
  const jornada = jornadaDelEvento(evento);
  const horasJornada = HORAS_POR_JORNADA[jornada];
  const [distribucionId, setDistribucionId] = useState(evento.distribucionId?.toString() ?? '');
  const [inicio, setInicio] = useState(
    evento.inicio
      ? comoFechaHoraLocal(evento.inicio)
      : evento.horaInicioEstimada
        ? `${fechaDelEvento}T${evento.horaInicioEstimada}`
        : '',
  );
  const [fin, setFin] = useState(
    evento.fin ? comoFechaHoraLocal(evento.fin) : inicio ? sumarHoras(inicio, horasJornada) : '',
  );

  // Cada vez que se elige el inicio, el fin se recalcula con la duración de la jornada. Después se
  // puede cambiar a mano; si se vuelve a tocar el inicio, se recalcula de nuevo.
  function elegirInicio(valor: string) {
    setInicio(valor);
    setFin(sumarHoras(valor, horasJornada));
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CrearPago>({
    resolver: zodResolver(esquemaCrearPago),
    defaultValues: { fecha: fechaDelEvento, monto: '' },
  });

  const enConsulta = evento.estado === 'EnConsulta';
  const distribuciones =
    salones.data?.find((salon) => salon.id === evento.salonId)?.distribuciones ?? [];
  const distribucionElegida = distribuciones.find((d) => d.id === Number(distribucionId));
  const superaCapacidad =
    distribucionElegida !== undefined && evento.cantidadPersonas > distribucionElegida.capacidad;
  const horarioCompleto = distribucionId !== '' && inicio !== '' && fin !== '';
  const horarioCambio =
    distribucionId !== (evento.distribucionId?.toString() ?? '') ||
    inicio !== (evento.inicio ? comoFechaHoraLocal(evento.inicio) : '') ||
    fin !== (evento.fin ? comoFechaHoraLocal(evento.fin) : '');

  function datosDelHorario() {
    return {
      distribucionId: Number(distribucionId),
      inicio: new Date(inicio).toISOString(),
      fin: new Date(fin).toISOString(),
      modalidadSalonRestaurante: evento.modalidadSalonRestaurante,
      // La pantalla ya avisa al lado de la distribución que no alcanza: elegirla igual es la
      // confirmación que pide la API.
      confirmarCapacidadExcedida: superaCapacidad,
    };
  }

  async function registrar(datos: CrearPago) {
    // Primero se agenda (si hay algo nuevo que agendar) y después se cobra: el pago que cruza la
    // seña necesita el horario ya guardado para evaluar RN-12. Si agendar falla, no se cobra.
    if (enConsulta && horarioCompleto && horarioCambio) {
      try {
        await agendarEvento.mutateAsync(datosDelHorario());
      } catch {
        return;
      }
    }
    registrarPago.mutate(datos, {
      // El medio de pago queda elegido: lo habitual es cargar varias entregas por el mismo medio.
      // El resto de los campos se nombran de a uno (incluida la observación, que vale ''): reset()
      // solo limpia lo que recibe en el objeto.
      onSuccess: () =>
        reset({
          fecha: fechaDelEvento,
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
  // Redondeado al centavo: la resta de dos number puede dejar 184058.00000000003.
  const faltaParaLaSena = Number((montoSena - Number(saldo.pagado)).toFixed(2));
  const resultado = registrarPago.data;

  // Distribución, inicio y fin: van dentro del formulario del pago, que agenda y cobra de una vez.
  const camposHorario = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="distribucionId">Distribución</Label>
        <select
          id="distribucionId"
          className={CLASES_SELECT}
          value={distribucionId}
          onChange={(e) => setDistribucionId(e.target.value)}
        >
          <option value="">{salones.isLoading ? 'Cargando…' : 'Elegir…'}</option>
          {distribuciones.map((distribucion) => (
            <option key={distribucion.id} value={distribucion.id}>
              {distribucion.nombre} · hasta {distribucion.capacidad} personas
            </option>
          ))}
        </select>
        {superaCapacidad && (
          <p className="text-xs text-amber-800">
            El evento es de {evento.cantidadPersonas} personas y esta distribución admite{' '}
            {distribucionElegida.capacidad}. Si la dejás, se agenda igual.
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="inicio">Hora de inicio</Label>
          <SelectorFechaHora
            id="inicio"
            value={inicio}
            onChange={elegirInicio}
            diaSugerido={fechaDelEvento}
            horaSugerida={evento.horaInicioEstimada ?? undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fin">Hora de fin</Label>
          <SelectorFechaHora
            id="fin"
            value={fin}
            onChange={setFin}
            diaSugerido={inicio.slice(0, 10) || fechaDelEvento}
            diaMinimo={inicio.slice(0, 10) || undefined}
          />
          <p className="text-xs text-muted-foreground">
            {jornada === 'media' ? 'Media jornada' : 'Jornada completa'}: se calcula {horasJornada}{' '}
            h después del inicio. Podés cambiarlo.
          </p>
        </div>
      </div>
      {enConsulta && !horarioCompleto && faltaParaLaSena > 0 && (
        <p className="text-xs text-muted-foreground">
          Para que el pago que llega al {PORCENTAJE_SENA}% reserve el salón, completá distribución,
          hora de inicio y hora de fin.
        </p>
      )}
    </div>
  );

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
              {enConsulta && !evento.salonId && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Para reservar el salón con la seña, primero elegí el salón desde la consulta y
                  guardá los cambios.
                </p>
              )}
              {enConsulta && evento.salonId && camposHorario}
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
                  {faltaParaLaSena > 0 && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() =>
                        setValue('monto', faltaParaLaSena.toFixed(2), { shouldValidate: true })
                      }
                    >
                      Cargar el {PORCENTAJE_SENA}% de seña
                    </Button>
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

              {enConsulta && agendarEvento.isError && (
                <p className="text-sm text-destructive">
                  {agendarEvento.error instanceof ErrorApiCliente
                    ? agendarEvento.error.message
                    : 'No se pudo guardar el horario del evento.'}
                </p>
              )}
              {registrarPago.isError && (
                <p className="text-sm text-destructive">
                  {registrarPago.error instanceof ErrorApiCliente
                    ? registrarPago.error.message
                    : 'No se pudo registrar el pago.'}
                </p>
              )}

              <Button
                type="submit"
                disabled={registrarPago.isPending || agendarEvento.isPending}
                className="w-full"
              >
                {registrarPago.isPending || agendarEvento.isPending
                  ? 'Registrando…'
                  : 'Registrar pago'}
              </Button>
            </form>

            {resultado?.reservoElSalon && (
              <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-medium">
                  Con este pago se alcanzó la seña: el presupuesto quedó confirmado y el salón
                  reservado.{' '}
                  <Link to="/admin/agenda" className="underline underline-offset-2">
                    Ver en la agenda
                  </Link>
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
