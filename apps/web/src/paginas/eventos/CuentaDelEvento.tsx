import {
  type CrearPago,
  esquemaCrearPago,
  type EventoDetallado,
  PORCENTAJE_SENA,
  type TipoJornada,
} from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
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
import { cn } from '@/lib/utils';
import { CLASES_SELECT } from './clases-select';

// Los pagos sí llevan centavos: a diferencia de formatearPesos (que redondea a pesos enteros para
// la landing), acá el importe es plata que entró y tiene que cuadrar hasta el último centavo.
const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const formateadorHorario = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
});
// Para el fin del evento: la fecha ya la dice el inicio y repetirla daba "10 de abr de 2027, 17:00
// a 10 de abr de 2027, 23:00". Un evento que termina pasada la medianoche igual se entiende.
const formateadorFin = new Intl.DateTimeFormat('es-AR', {
  timeStyle: 'short',
  hourCycle: 'h23',
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

/**
 * HU-14 completa: el estado de cuenta del evento (criterio 2) y el formulario de cobro. Registrar
 * un pago puede cambiarle el estado al evento como efecto, no como acción aparte: al cruzar el 20%
 * de la base de cobro se confirma el presupuesto y se reserva el salón (HU-13), y al 100% el evento
 * pasa a Cobrado. De ahí el aviso de abajo de la cuenta: el pago que reserva el salón es el único
 * momento en que hace falta contar las consultas que quedaron pisando la franja. El paso a Cobrado
 * se ve solo: `admitePagos` se apaga y el botón de cobro desaparece.
 *
 * La cuenta se lee de un vistazo (saldo grande y una barra con la marca de la seña) y el formulario
 * de cobro se abre en un diálogo: siempre visible ocupaba media pantalla aunque no se fuera a cobrar.
 */
export function CuentaDelEvento({ evento, admitePagos }: CuentaDelEventoProps) {
  const eventoId = evento.id;
  const cuenta = usePagosDeEvento(eventoId);
  const mediosPago = useMediosPago();
  const registrarPago = useRegistrarPago(eventoId);
  const agendarEvento = useAgendarEvento(eventoId);
  const salones = useSalones();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [editandoHorario, setEditandoHorario] = useState(false);

  // `fecha` viaja como medianoche UTC del día del evento: el día es la parte YYYY-MM-DD, sin pasar
  // por Date (que lo correría al día anterior en Argentina). Es la fecha que se propone para el
  // pago, a pedido del Responsable de Eventos.
  const fechaDelEvento = evento.fecha.slice(0, 10);

  // Agendar va en el mismo formulario del pago (ADR 0007: sin distribución y horario no se puede
  // reservar el salón). Se precargan con lo ya agendado o, si no, el inicio con la hora estimada
  // de la consulta y el fin calculado según la jornada.
  const jornada = jornadaDelEvento(evento);
  const horasJornada = HORAS_POR_JORNADA[jornada];
  // La distribución de cada salón del evento (ADR 0011): salonId → id de la distribución, '' si
  // todavía no se eligió. Se precarga con la que cada salón ya tiene armada.
  const distribucionesIniciales = new Map(
    evento.salones.map((salon) => [salon.id, salon.distribucion?.id.toString() ?? '']),
  );
  const [distribucionPorSalon, setDistribucionPorSalon] = useState(distribucionesIniciales);

  function elegirDistribucion(salonId: number, distribucionId: string) {
    setDistribucionPorSalon((anteriores) => new Map(anteriores).set(salonId, distribucionId));
  }
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
  const cobrado = evento.estado === 'Cobrado';
  // Las distribuciones posibles de cada salón del evento, con la elegida.
  const porSalon = evento.salones.map((salonDelEvento) => {
    const opciones =
      salones.data?.find((salon) => salon.id === salonDelEvento.id)?.distribuciones ?? [];
    const elegidaId = distribucionPorSalon.get(salonDelEvento.id) ?? '';
    return {
      salon: salonDelEvento,
      opciones,
      elegidaId,
      elegida: opciones.find((d) => d.id === Number(elegidaId)),
    };
  });
  // Con varios salones la gente se reparte: se compara contra la capacidad sumada. Es un aviso,
  // no un tope (ADR 0011).
  const todasElegidas = porSalon.length > 0 && porSalon.every((s) => s.elegida !== undefined);
  const capacidadElegida = porSalon.reduce((suma, s) => suma + (s.elegida?.capacidad ?? 0), 0);
  const superaCapacidad = todasElegidas && evento.cantidadPersonas > capacidadElegida;
  const horarioCompleto = todasElegidas && inicio !== '' && fin !== '';
  const horarioCambio =
    porSalon.some((s) => s.elegidaId !== (distribucionesIniciales.get(s.salon.id) ?? '')) ||
    inicio !== (evento.inicio ? comoFechaHoraLocal(evento.inicio) : '') ||
    fin !== (evento.fin ? comoFechaHoraLocal(evento.fin) : '');

  function datosDelHorario() {
    return {
      distribuciones: porSalon.map((s) => ({
        salonId: s.salon.id,
        distribucionId: Number(s.elegidaId),
      })),
      inicio: new Date(inicio).toISOString(),
      fin: new Date(fin).toISOString(),
      modalidadSalonRestaurante: evento.modalidadSalonRestaurante,
      // La pantalla ya avisa debajo de las distribuciones que no alcanzan: elegirlas igual es la
      // confirmación que pide la API.
      confirmarCapacidadExcedida: superaCapacidad,
    };
  }

  // Evento confirmado: agendar no le cambia el estado, solo mueve la franja (RN-12 la controla).
  function guardarHorario() {
    agendarEvento.mutate(datosDelHorario(), { onSuccess: () => setEditandoHorario(false) });
  }

  // Al abrir el diálogo se limpian los errores del intento anterior (y el aviso de reserva, que ya
  // se leyó). El formulario conserva lo que tenía, por si se cerró sin querer.
  function abrirDialogo(abrir: boolean) {
    if (abrir) {
      registrarPago.reset();
      agendarEvento.reset();
    }
    setDialogoAbierto(abrir);
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
      onSuccess: () => {
        reset({
          fecha: fechaDelEvento,
          monto: '',
          observacion: '',
          medioPagoId: datos.medioPagoId,
        });
        setDialogoAbierto(false);
      },
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
  const porcentajeAbonado = Math.min(100, Math.max(0, Number(saldo.porcentajeAbonado)));
  const saldoPendiente = Number(saldo.saldo);

  const errorAgendar =
    agendarEvento.isError &&
    (agendarEvento.error instanceof ErrorApiCliente
      ? agendarEvento.error.message
      : 'No se pudo guardar el horario del evento.');

  // Distribución, inicio y fin. En consulta van dentro del formulario del pago (agenda y cobra de una
  // vez); con el evento confirmado van en su propia tarjeta, para cambiarlos sin registrar un pago
  // (RN-09: el Responsable de Eventos modifica en todo momento).
  const camposHorario = (
    <div className="space-y-4">
      {/* Una distribución por cada salón: un evento puede ocupar varios a la vez (ADR 0011). */}
      <div className="space-y-3">
        {porSalon.map(({ salon, opciones, elegidaId }) => (
          <div key={salon.id} className="space-y-1.5">
            <Label htmlFor={`distribucion-${salon.id}`}>
              {porSalon.length === 1 ? 'Distribución' : `Distribución de ${salon.nombre}`}
            </Label>
            <select
              id={`distribucion-${salon.id}`}
              className={CLASES_SELECT}
              value={elegidaId}
              onChange={(e) => elegirDistribucion(salon.id, e.target.value)}
            >
              <option value="">{salones.isLoading ? 'Cargando…' : 'Elegir…'}</option>
              {opciones.map((distribucion) => (
                <option key={distribucion.id} value={distribucion.id}>
                  {distribucion.nombre} · hasta {distribucion.capacidad} personas
                </option>
              ))}
            </select>
          </div>
        ))}
        {superaCapacidad && (
          <p className="text-xs text-amber-800">
            El evento es de {evento.cantidadPersonas} personas y{' '}
            {porSalon.length === 1
              ? `esta distribución admite ${capacidadElegida}`
              : `estas distribuciones admiten ${capacidadElegida} entre todas`}
            . Si las dejás, se agenda igual.
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
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {jornada === 'media' ? 'Media jornada' : 'Jornada completa'}: el fin se calcula{' '}
        {horasJornada} h después del inicio. Podés cambiarlo.
      </p>
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
        <CardContent className="space-y-4 text-sm">
          {/* Un evento cobrado no tiene saldo que mirar: lo que importa es cuánto entró y que
              ya está completo. Va en el verde con el que la agenda marca los eventos que ocupan el
              salón, para que se lea de un vistazo sin tener que interpretar un $0 de saldo. */}
          {cobrado ? (
            <div className="rounded-xl bg-emerald-700 px-4 py-3 text-crema">
              <p className="text-xs font-medium tracking-wide uppercase opacity-90">
                Evento cobrado
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {formateadorMoneda.format(base)}
              </p>
              <p className="text-xs opacity-90">
                Total cobrado por completo ({saldo.incluyeIva ? 'con IVA' : 'sin IVA'})
              </p>
            </div>
          ) : (
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {formateadorMoneda.format(saldoPendiente)}
              </p>
              <p className="text-xs text-muted-foreground">
                Saldo pendiente · base de cobro {formateadorMoneda.format(base)} (
                {saldo.incluyeIva ? 'con IVA' : 'sin IVA'})
              </p>
            </div>
          )}

          {/* Barra de lo abonado. Mientras el evento está en consulta lleva la marca de la seña: es
              el umbral que reserva el salón (HU-13). Con el evento cobrado no aporta: estaría
              siempre al 100% debajo del cartel que ya lo dice. */}
          <div className={cn('space-y-1.5', cobrado && 'hidden')}>
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
              {enConsulta && (
                <span className="text-dorado-texto">
                  Seña {PORCENTAJE_SENA}%: {formateadorMoneda.format(montoSena)}
                </span>
              )}
            </div>
          </div>

          {/* RN-01: la base incluye el IVA solo si el presupuesto se factura, así que la seña del
              20% cambia de monto según eso. Por eso se aclara sobre qué se calculó. */}
          {/* Una vez reservado, la seña ya se cobró aunque después suba el total (RN-09): no se
              vuelve a pedir el 20%, se cobra el saldo. */}
          <p className={cn('text-xs text-muted-foreground', cobrado && 'hidden')}>
            {enConsulta
              ? faltaParaLaSena > 0
                ? `Faltan ${formateadorMoneda.format(faltaParaLaSena)} para la seña y reservar el salón.`
                : 'La seña ya está cubierta.'
              : saldoPendiente < 0
                ? 'Lo pagado supera el total: hay que resolver la diferencia con el cliente.'
                : 'La seña ya se cobró y el salón está reservado.'}
          </p>

          {resultado?.reservoElSalon && (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
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
          {registrarPago.isSuccess && !resultado?.reservoElSalon && (
            <p className="text-sm text-emerald-800">Pago registrado.</p>
          )}

          {admitePagos && (
            <Button className="w-full" size="lg" onClick={() => abrirDialogo(true)}>
              <Plus /> {enConsulta ? 'Agendar y registrar pago' : 'Registrar pago'}
            </Button>
          )}

          <div className="border-t pt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Pagos</p>
            {pagos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todavía no hay pagos.
                {enConsulta && ' El que llegue a la seña confirma el evento.'}
              </p>
            ) : (
              <ul className="divide-y">
                {pagos.map((pago) => (
                  <li key={pago.id} className="py-2">
                    <div className="flex justify-between gap-3">
                      <span>
                        {fechaLocal(pago.fecha).toLocaleDateString('es-AR')} ·{' '}
                        {pago.medioPago.nombre}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formateadorMoneda.format(Number(pago.monto))}
                      </span>
                    </div>
                    {pago.observacion && (
                      <p className="text-xs text-muted-foreground">{pago.observacion}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {!enConsulta && evento.estado !== 'Cancelado' && (
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>Horario del evento</CardTitle>
            {!editandoHorario && (
              <Button variant="outline" size="sm" onClick={() => setEditandoHorario(true)}>
                Cambiar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {editandoHorario ? (
              <>
                {camposHorario}
                {errorAgendar && <p className="text-sm text-destructive">{errorAgendar}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={!horarioCompleto || !horarioCambio || agendarEvento.isPending}
                    onClick={guardarHorario}
                  >
                    {agendarEvento.isPending ? 'Guardando…' : 'Guardar horario'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      agendarEvento.reset();
                      setEditandoHorario(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>
                  {evento.inicio && evento.fin
                    ? `${formateadorHorario.format(new Date(evento.inicio))} a ${formateadorFin.format(new Date(evento.fin))}`
                    : 'Sin horario cargado.'}
                </p>
                {agendarEvento.isSuccess && (
                  <p className="text-sm text-emerald-800">Horario guardado.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {admitePagos && (
        <Dialog.Root open={dialogoAbierto} onOpenChange={abrirDialogo}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-bordo-oscuro/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-papel p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="font-heading text-lg font-medium">
                    {enConsulta ? 'Agendar y registrar pago' : 'Registrar pago'}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    {enConsulta
                      ? `Si el pago llega a la seña (${formateadorMoneda.format(montoSena)}), el presupuesto se confirma y el salón queda reservado.`
                      : `Saldo pendiente: ${formateadorMoneda.format(saldoPendiente)}.`}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Cerrar"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>

              <form onSubmit={handleSubmit(registrar)} className="mt-5 space-y-5">
                {enConsulta && evento.salones.length === 0 && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Para reservar el salón con la seña, primero elegí el salón desde la consulta y
                    guardá los cambios.
                  </p>
                )}
                {enConsulta && evento.salones.length > 0 && (
                  <fieldset className="space-y-3">
                    <legend className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Horario
                    </legend>
                    {camposHorario}
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
                      <Input id="fecha" type="date" {...register('fecha')} />
                      {errors.fecha && (
                        <p className="text-xs text-destructive">{errors.fecha.message}</p>
                      )}
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
                  <p className="text-sm text-destructive">{errorAgendar}</p>
                )}
                {registrarPago.isError && (
                  <p className="text-sm text-destructive">
                    {registrarPago.error instanceof ErrorApiCliente
                      ? registrarPago.error.message
                      : 'No se pudo registrar el pago.'}
                  </p>
                )}

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Dialog.Close asChild>
                    <Button type="button" variant="ghost">
                      Cancelar
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="submit"
                    disabled={registrarPago.isPending || agendarEvento.isPending}
                  >
                    {registrarPago.isPending || agendarEvento.isPending
                      ? 'Registrando…'
                      : 'Registrar pago'}
                  </Button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
