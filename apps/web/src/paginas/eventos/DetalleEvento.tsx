import type { EstadoEvento } from '@confluens/shared';
import { Check, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { useState } from 'react';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCancelarEvento, useEvento } from '@/hooks/use-eventos';
import { useArmarPresupuestoDeEvento } from '@/hooks/use-presupuestos';
import { ErrorApiCliente } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CuentaDelEvento } from './CuentaDelEvento';
import { ESTADOS } from './estado-evento';

// En 24 horas, como la agenda de la que se viene y como la tarjeta de resumen: "6:00 a. m." al
// lado de "06:00" se lee como dos horarios distintos.
const formateadorFecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
});
const formateadorHora = new Intl.DateTimeFormat('es-AR', {
  timeStyle: 'short',
  hourCycle: 'h23',
});
const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

// Cuántas líneas del presupuesto se ven sin desplegar. Un evento con todo el catálogo cotizado
// tiene más de veinte, y sin este corte la cuenta y el cobro quedaban al fondo de un scroll largo.
const LINEAS_VISIBLES = 5;

// Recorrido del evento. Cancelado no tiene paso: sale del recorrido y se muestra solo el badge.
const PASOS = ['Consulta', 'Seña', 'Confirmado', 'Cobrado'] as const;
const PASOS_HECHOS: Partial<Record<EstadoEvento, number>> = {
  EnConsulta: 1,
  Reservado: 3,
  Cobrado: 4,
};

function PasosDelEvento({ estado }: { estado: EstadoEvento }) {
  const hechos = PASOS_HECHOS[estado];
  if (hechos === undefined) return null;
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs" aria-label="Avance">
      {PASOS.map((paso, i) => {
        const hecho = i < hechos;
        const actual = i === hechos;
        return (
          <li key={paso} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/50">›</span>}
            <span
              aria-current={actual ? 'step' : undefined}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
                hecho && 'text-emerald-800',
                actual && 'bg-bordo/10 font-medium text-bordo',
                !hecho && !actual && 'text-muted-foreground',
              )}
            >
              {hecho && <Check className="size-3" aria-hidden />}
              {paso}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 truncate">{children}</dd>
    </div>
  );
}

interface DetalleEventoProps {
  eventoId: number;
  // HU-11: abre el detalle completo del presupuesto (líneas, IVA, vigencia y los demás del evento).
  onVerPresupuesto?: (presupuestoId: number) => void;
  // Comanda de cocina del evento confirmado: la hoja sin precios que se imprime y se cuelga.
  onImprimirComanda?: (presupuestoId: number) => void;
}

// Vista central del evento: datos, presupuesto, cuenta y cancelación (criterio 5 / RN-07). No hay
// un paso aparte para agendar: la distribución y el horario se cargan en el mismo formulario del
// pago (CuentaDelEvento), que agenda y cobra de una vez. El evento sigue EnConsulta hasta que los
// pagos cruzan el 20% de la base de cobro (HU-13).
//
// Dos columnas desde lg: a la izquierda lo que se lee (datos y presupuesto), a la derecha la cuenta,
// fija al hacer scroll para que el saldo y el botón de cobro estén siempre a mano. En pantallas
// angostas la cuenta va arriba del presupuesto, que es lo que se viene a hacer a esta vista.
export function DetalleEvento({
  eventoId,
  onVerPresupuesto,
  onImprimirComanda,
}: DetalleEventoProps) {
  const { data: evento, isLoading, isError } = useEvento(eventoId);
  const cancelarEvento = useCancelarEvento(eventoId);
  const armarPresupuesto = useArmarPresupuestoDeEvento(eventoId);
  const [presupuestoDesplegado, setPresupuestoDesplegado] = useState(false);

  if (isLoading) return <p className="py-6 text-sm text-muted-foreground">Cargando…</p>;
  if (isError || !evento) {
    return <p className="py-6 text-sm text-destructive">No se pudo cargar el evento.</p>;
  }

  const presupuestoVigente =
    evento.presupuestos.find((p) => p.estado === 'Confirmado') ??
    evento.presupuestos.find((p) => p.estado === 'Estimado') ??
    evento.presupuestos[0];
  const total = presupuestoVigente ? Number(presupuestoVigente.total) : 0;
  const lineas = presupuestoVigente?.lineas ?? [];
  const lineasOcultas = Math.max(0, lineas.length - LINEAS_VISIBLES);
  const lineasAMostrar = presupuestoDesplegado ? lineas : lineas.slice(0, LINEAS_VISIBLES);

  const estado = ESTADOS[evento.estado];

  // Sin base de cobro contra la que medir nada: o el evento no tiene presupuesto, o tiene el vacío
  // de una consulta social, que se reconoce por venceEn en null (ADR 0008, presupuesto.esquema.ts).
  // En los dos casos la cuenta mostraría $0 y cualquier pago lo rechazaría la API por superar el
  // total, así que en su lugar va el aviso.
  const presupuestoSinArmar = presupuestoVigente?.venceEn === null;

  // Un evento sin presupuesto no tiene consulta que abrir: primero se le crea el vacío y recién
  // ahí se puede ir a cargarle salón y servicios. Si ya lo tiene (una consulta social), se abre
  // directo.
  function armarElPresupuesto() {
    if (presupuestoVigente) {
      onVerPresupuesto?.(presupuestoVigente.id);
      return;
    }
    armarPresupuesto.mutate(undefined, {
      onSuccess: (nuevo) => onVerPresupuesto?.(nuevo.id),
    });
  }

  function manejarCancelacion() {
    if (!window.confirm('¿Cancelar este evento? Esta acción no se puede deshacer.')) return;
    cancelarEvento.mutate();
  }

  const horario =
    evento.inicio && evento.fin
      ? `${formateadorFecha.format(new Date(evento.inicio))} a ${formateadorHora.format(new Date(evento.fin))}`
      : null;

  return (
    // Todo el evento vive en un solo panel: las tarjetas blancas sueltas sobre el crema de la
    // página se leían como recortes sin relación. El panel va en el beige de la paleta, con un
    // filete dorado, y adentro las tarjetas quedan como hojas apoyadas sobre él.
    <div className="space-y-5 rounded-2xl bg-secondary/80 p-4 ring-1 ring-dorado/25 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-dorado/25 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-bordo">Evento #{evento.id}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              title={estado.ayuda}
              className={cn('rounded-full px-2 py-0.5 text-xs font-medium', estado.clase)}
            >
              {estado.etiqueta}
            </span>
            <BadgeTipoEvento evento={evento} />
          </div>
        </div>
        <PasosDelEvento estado={evento.estado} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,380px)] lg:items-start">
        {/* Columna de la cuenta. Va primero en el DOM para quedar arriba en mobile; en lg pasa a la
            segunda columna. top-28: deja libre el encabezado fijo del panel. */}
        <div className="space-y-4 lg:sticky lg:top-28 lg:col-start-2 lg:row-start-1">
          {/* HU-14: el saldo, el cobro y el historial. Cuando no hay base de cobro va el aviso
              en su lugar: la vista es la misma se entre desde la agenda o desde la consulta, y el
              hueco se explica en vez de desaparecer. */}
          {presupuestoVigente && !presupuestoSinArmar ? (
            <CuentaDelEvento
              evento={evento}
              admitePagos={evento.estado !== 'Cancelado' && evento.estado !== 'Cobrado'}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  {presupuestoSinArmar ? 'Presupuesto sin armar' : 'Sin presupuesto'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {presupuestoSinArmar
                    ? 'El presupuesto todavía no tiene nada cargado, así que no hay base de cobro que calcular.'
                    : 'El evento no tiene ningún presupuesto asociado al que calcularle una base de cobro.'}
                </p>
                {armarPresupuesto.isError && (
                  <p className="text-destructive">
                    {armarPresupuesto.error instanceof ErrorApiCliente
                      ? armarPresupuesto.error.message
                      : 'No se pudo armar el presupuesto.'}
                  </p>
                )}
                {/* Armar el presupuesto solo tiene sentido con el evento en consulta: el que se
                    crea nace Estimado y la API rechaza un Estimado sobre un evento ya reservado,
                    cobrado o cancelado. El sin armar ya existe, así que solo se abre. */}
                {(presupuestoSinArmar || evento.estado === 'EnConsulta') && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={armarPresupuesto.isPending}
                    onClick={armarElPresupuesto}
                  >
                    {armarPresupuesto.isPending ? 'Armando…' : 'Armar el presupuesto'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          {(evento.estado === 'Cancelado' || evento.estado === 'Cobrado') && (
            <p className="text-sm text-muted-foreground">
              Este evento está {evento.estado === 'Cancelado' ? 'cancelado' : 'cobrado'}, no admite
              más acciones.
            </p>
          )}
        </div>

        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <Card>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Dato etiqueta="Cliente">
                  <span className="font-medium">{evento.cliente.nombre}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {evento.cliente.telefono} · {evento.cliente.correo}
                  </span>
                </Dato>
                <Dato etiqueta="Salón">
                  {evento.salon?.nombre ?? 'A definir'} · {evento.cantidadPersonas} personas
                  {evento.distribucion && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {evento.distribucion.nombre}
                    </span>
                  )}
                </Dato>
                <Dato etiqueta="Horario">
                  {horario ?? <span className="text-muted-foreground">Sin agendar</span>}
                </Dato>
                {evento.solicitud && (
                  <Dato etiqueta="Consulta original">
                    {formateadorFecha.format(new Date(evento.solicitud.creadoEn))}
                  </Dato>
                )}
              </dl>
            </CardContent>
          </Card>

          {presupuestoVigente && (
            <Card>
              <CardHeader className="flex items-baseline justify-between gap-2">
                <CardTitle>Presupuesto ({presupuestoVigente.estado})</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {lineas.length} {lineas.length === 1 ? 'ítem' : 'ítems'}
                </span>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {lineasAMostrar.map((linea) => (
                    <li key={linea.id} className="flex justify-between gap-4 py-1.5">
                      <span className="min-w-0">
                        {linea.descripcion}{' '}
                        <span className="text-muted-foreground">
                          ×{linea.cantidad}
                          {/* La hora a la que se espera el servicio, si se pidió una. */}
                          {linea.horaEstimada && ` · ${linea.horaEstimada}`}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {linea.aCotizar
                          ? 'A cotizar'
                          : formateadorMoneda.format(Number(linea.subtotal))}
                      </span>
                    </li>
                  ))}
                </ul>
                {lineasOcultas > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 -ml-2.5 text-muted-foreground"
                    aria-expanded={presupuestoDesplegado}
                    onClick={() => setPresupuestoDesplegado((abierto) => !abierto)}
                  >
                    {presupuestoDesplegado ? (
                      <>
                        <ChevronUp /> Ver menos
                      </>
                    ) : (
                      <>
                        <ChevronDown /> Ver{' '}
                        {lineasOcultas === 1
                          ? 'el ítem restante'
                          : `los ${lineasOcultas} restantes`}
                      </>
                    )}
                  </Button>
                )}
                <div className="mt-2 flex items-center justify-between gap-3 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {onVerPresupuesto && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onVerPresupuesto(presupuestoVigente.id)}
                      >
                        Ver detalle del presupuesto
                      </Button>
                    )}
                    {/* Solo con el presupuesto confirmado: antes de la seña el evento todavía se
                        puede caer y la cocina no tiene nada que preparar. */}
                    {onImprimirComanda && presupuestoVigente.estado === 'Confirmado' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onImprimirComanda(presupuestoVigente.id)}
                      >
                        <Printer /> Comanda de cocina
                      </Button>
                    )}
                  </div>
                  <p className="text-right">
                    <span className="block text-xs text-muted-foreground">Total sin IVA</span>
                    <span className="font-medium tabular-nums">
                      {formateadorMoneda.format(total)}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
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
        </div>
      </div>
    </div>
  );
}
