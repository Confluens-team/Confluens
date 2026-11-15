import { type EstadoEvento, veAuditoria } from '@confluens/shared';
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  History,
  Printer,
  Repeat2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { horarioDeLosDias, resumenDelEvento } from '@/lib/dias-del-evento';
import {
  armadoDelEvento,
  formatearFechaNumerica,
  nombresDeSalones,
  textoModalidad,
} from '@/lib/formato';
import { textoDeDias } from '@/lib/rango-de-fechas';
import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { BotonWhatsApp } from '@/components/BotonWhatsApp';
import { Pestanias } from '@/components/Pestanias';
import { TarjetaCliente } from '@/components/TarjetaCliente';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconoEstado } from '@/components/IconoEstado';
import { useCancelarEvento, useEvento } from '@/hooks/use-eventos';
import { useArmarPresupuestoDeEvento } from '@/hooks/use-presupuestos';
import { useSesion } from '@/hooks/use-sesion';
import { ErrorApiCliente } from '@/lib/api';
import { cn } from '@/lib/utils';
import { mensajeWhatsApp } from '@/lib/whatsapp';
import { CuentaDelEvento } from './CuentaDelEvento';
import { EditorDeHorario } from './EditorDeHorario';
import { ESTADOS } from './estado-evento';
import { ObservacionesDelEvento } from './ObservacionesDelEvento';
import { NavegadorDeDias } from './NavegadorDeDias';
import { PresupuestoPorDia } from './PresupuestoPorDia';
import { ReutilizarConfiguracion } from './ReutilizarConfiguracion';
import { HistorialDelRegistro } from '@/paginas/auditoria/HistorialDelRegistro';

// Las pestañas del detalle de un evento (15/11/2026). Historial solo para el GG y el ADM.
type PestaniaDeEvento = 'detalle' | 'pagos' | 'historial';

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
                hecho && 'text-estado-confirmado-texto',
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
  // HU-24: abre la consulta nueva creada con «Repetir evento». Sin esto, el botón no aparece.
  onAbrirConsulta?: (presupuestoId: number, eventoId: number) => void;
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
  onAbrirConsulta,
}: DetalleEventoProps) {
  const { data: evento, isLoading, isError } = useEvento(eventoId);
  const cancelarEvento = useCancelarEvento(eventoId);
  const armarPresupuesto = useArmarPresupuestoDeEvento(eventoId);
  const [presupuestoDesplegado, setPresupuestoDesplegado] = useState(false);
  const [repitiendo, setRepitiendo] = useState(false);
  // HU-50: el día que se está mirando de un evento de varios días (observaciones y presupuesto).
  const [diaVisible, setDiaVisible] = useState(0);
  // 15/11/2026: Detalle, Pagos o Historial, arriba a la derecha del título. El Historial (diseño D)
  // lo ven solo los roles que ven la auditoría.
  const [pestania, setPestania] = useState<PestaniaDeEvento>('detalle');
  const { data: sesion } = useSesion();
  const veHistorial = !!sesion && veAuditoria(sesion.rol);
  const pestaniaVisible: PestaniaDeEvento =
    pestania === 'historial' && !veHistorial ? 'detalle' : pestania;

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

  // HU-23: la cancelación pide confirmación explícita. En un evento confirmado el aviso dice qué
  // implica: el salón queda libre y lo abonado no se reintegra (RN-06).
  function manejarCancelacion() {
    const aviso =
      evento?.estado === 'Reservado'
        ? '¿Cancelar este evento? El salón queda libre en ese horario y lo abonado no se reintegra. Esta acción no se puede deshacer.'
        : '¿Cancelar esta consulta? Esta acción no se puede deshacer.';
    if (!window.confirm(aviso)) return;
    cancelarEvento.mutate();
  }

  // El rechazo de la API (por ejemplo, RN-07 con menos de 48 horas) lo comparten la consulta
  // (EnConsulta) y el evento confirmado (Reservado).
  const errorDeCancelacion = cancelarEvento.isError && (
    <p role="alert" className="text-sm text-destructive">
      {cancelarEvento.error instanceof ErrorApiCliente
        ? cancelarEvento.error.message
        : 'No se pudo cancelar el evento.'}
    </p>
  );

  const horario =
    evento.inicio && evento.fin
      ? `${formateadorFecha.format(new Date(evento.inicio))} a ${formateadorHora.format(new Date(evento.fin))}`
      : null;

  // Las fechas pueden llegar con hora (medianoche UTC): se comparan como días de calendario.
  const primerDia = evento.fecha.slice(0, 10);
  const ultimoDia = (evento.dias[evento.dias.length - 1]?.fecha ?? evento.fecha).slice(0, 10);
  const fechaDelEvento =
    ultimoDia !== primerDia
      ? `Del ${formatearFechaNumerica(primerDia)} al ${formatearFechaNumerica(ultimoDia)} · ${textoDeDias(primerDia, ultimoDia)}`
      : formatearFechaNumerica(primerDia);
  const sePuedeCancelar = evento.estado === 'EnConsulta' || evento.estado === 'Reservado';

  // Lo de la pestaña Pagos: la cuenta o, sin base de cobro, el aviso con «Armar el presupuesto».
  const pagos =
    presupuestoVigente && !presupuestoSinArmar ? (
      <CuentaDelEvento
        evento={evento}
        admitePagos={evento.estado !== 'Cancelado' && evento.estado !== 'Cobrado'}
      />
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>{presupuestoSinArmar ? 'Presupuesto sin armar' : 'Sin presupuesto'}</CardTitle>
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
          {/* Armar el presupuesto solo tiene sentido con el evento en consulta: el que se crea nace
              Estimado y la API rechaza un Estimado sobre un evento ya reservado, cobrado o
              cancelado. El sin armar ya existe, así que solo se abre. */}
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
    );

  return (
    // Todo el evento vive en un solo panel: las tarjetas blancas sueltas sobre el crema de la
    // página se leían como recortes sin relación. El panel va en el beige de la paleta, con un
    // filete dorado, y adentro las tarjetas quedan como hojas apoyadas sobre él.
    <div className="space-y-5 rounded-2xl bg-secondary/80 p-4 ring-1 ring-dorado/25 sm:p-6">
      {/* El título queda en todas las pestañas: número, estado, tipo, fecha y avance. Las pestañas
          van arriba a la derecha (15/11/2026). */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-dorado/25 pb-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold text-bordo">Evento #{evento.id}</h1>
            <span
              title={estado.ayuda}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                estado.clase,
              )}
            >
              <IconoEstado estado={evento.estado} />
              {estado.etiqueta}
            </span>
            <BadgeTipoEvento evento={evento} />
          </div>
          <p className="text-sm text-muted-foreground">{fechaDelEvento}</p>
          <PasosDelEvento estado={evento.estado} />
        </div>
        <Pestanias<PestaniaDeEvento>
          etiqueta="Secciones del evento"
          valor={pestaniaVisible}
          onCambiar={setPestania}
          pestanias={[
            { valor: 'detalle', texto: 'Detalle', icono: FileText },
            { valor: 'pagos', texto: 'Pagos', icono: Wallet },
            ...(veHistorial
              ? [{ valor: 'historial' as const, texto: 'Historial', icono: History }]
              : []),
          ]}
        />
      </header>
      {onAbrirConsulta && evento.estado === 'Cobrado' && (
        <ReutilizarConfiguracion
          eventoId={evento.id}
          cantidadDeDias={evento.dias.length}
          abierto={repitiendo}
          onCambiarAbierto={setRepitiendo}
          onAbrirConsulta={({ consulta }) => onAbrirConsulta(consulta.id, consulta.evento.id)}
        />
      )}

      {pestaniaVisible === 'historial' && <HistorialDelRegistro eventoId={evento.id} />}

      {/* Detalle y Pagos se ocultan, no se desmontan: el horario o las observaciones que se estaban
          editando no se pierden al cambiar de pestaña. */}
      <div className={pestaniaVisible === 'historial' ? 'hidden' : 'space-y-4'}>
        <TarjetaCliente
          nombre={evento.cliente.nombre}
          correo={evento.cliente.correo}
          telefono={evento.cliente.telefono}
          etiqueta={evento.cliente.etiqueta}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <BotonWhatsApp
              telefono={evento.cliente.telefono}
              mensaje={mensajeWhatsApp(evento.cliente.nombre, evento.estado)}
            />
            {/* HU-24: solo se repite un evento Cobrado (decisión de Franco, 17/10/2026). */}
            {onAbrirConsulta && evento.estado === 'Cobrado' && (
              <Button variant="outline" size="sm" onClick={() => setRepitiendo(true)}>
                <Repeat2 /> Repetir evento
              </Button>
            )}
            {onVerPresupuesto && presupuestoVigente && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onVerPresupuesto(presupuestoVigente.id)}
              >
                <FileText /> Ver presupuesto
              </Button>
            )}
            {/* Solo con el presupuesto confirmado: antes de la seña el evento todavía se puede caer y
                la cocina no tiene nada que preparar. */}
            {onImprimirComanda && presupuestoVigente?.estado === 'Confirmado' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onImprimirComanda(presupuestoVigente.id)}
              >
                <Printer /> Comanda de cocina
              </Button>
            )}
            {sePuedeCancelar && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={cancelarEvento.isPending}
                onClick={manejarCancelacion}
              >
                <XCircle />{' '}
                {evento.estado === 'Reservado' ? 'Cancelar evento' : 'Cancelar consulta'}
              </Button>
            )}
          </div>
          {errorDeCancelacion}
        </TarjetaCliente>

        <div className={pestaniaVisible === 'detalle' ? 'space-y-4' : 'hidden'}>
          <Card>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Dato etiqueta="Salón">
                  {nombresDeSalones(evento.salones)} · {resumenDelEvento(evento).personas}
                  {armadoDelEvento(evento) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {armadoDelEvento(evento)}
                    </span>
                  )}
                </Dato>
                <Dato etiqueta="Horario">
                  {/* El lápiz está a la derecha del horario: desde ahí se cargan el horario y la
                      distribución (RN-09), que el pago ya no pide. */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {evento.dias.length > 1
                        ? (horarioDeLosDias(evento.dias) ?? (
                            <span className="text-muted-foreground">Sin agendar</span>
                          ))
                        : (horario ?? <span className="text-muted-foreground">Sin agendar</span>)}
                    </span>
                    {evento.estado !== 'Cancelado' && <EditorDeHorario evento={evento} />}
                  </div>
                </Dato>
                {evento.solicitud && (
                  <Dato etiqueta="Consulta original">
                    {formateadorFecha.format(new Date(evento.solicitud.creadoEn))}
                  </Dato>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* HU-50: un evento de varios días va en un solo bloque: el selector de día y, debajo, lo
              que cambia con él (las observaciones y el presupuesto de ese día, con el total). */}
          {evento.dias.length > 1 ? (
            <Card>
              <NavegadorDeDias
                dias={evento.dias}
                indice={Math.min(diaVisible, evento.dias.length - 1)}
                onCambiar={setDiaVisible}
              />
              <div className="border-t pt-(--card-spacing)">
                <ObservacionesDelEvento
                  key={evento.dias[Math.min(diaVisible, evento.dias.length - 1)]!.id}
                  evento={evento}
                  dia={evento.dias[Math.min(diaVisible, evento.dias.length - 1)]!}
                  integrada
                />
              </div>
              {presupuestoVigente && (
                <div className="border-t pt-(--card-spacing)">
                  <PresupuestoPorDia
                    evento={evento}
                    presupuesto={presupuestoVigente}
                    indice={diaVisible}
                    onVerPresupuesto={onVerPresupuesto}
                    onImprimirComanda={onImprimirComanda}
                  />
                </div>
              )}
            </Card>
          ) : (
            <ObservacionesDelEvento
              key={evento.dias[0]!.id}
              evento={evento}
              dia={evento.dias[0]!}
            />
          )}
          {presupuestoVigente && evento.dias.length === 1 && (
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
                          {/* RN-11: continuo o en mesa, si el servicio la lleva. */}
                          {linea.modalidad !== 'Normal' && ` · ${textoModalidad(linea.modalidad)}`}
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
                <p className="mt-2 border-t pt-3 text-right">
                  <span className="block text-xs text-muted-foreground">Total sin IVA</span>
                  <span className="font-medium tabular-nums">
                    {formateadorMoneda.format(total)}
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          {evento.estado === 'Reservado' && (
            <Card>
              <CardHeader>
                <CardTitle>Reserva</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {evento.senaRegistradaEn && (
                  <p>
                    El salón quedó reservado el{' '}
                    {formateadorFecha.format(new Date(evento.senaRegistradaEn))}, cuando los pagos
                    alcanzaron la seña.
                  </p>
                )}
                <p>
                  Se puede cancelar hasta 48 horas corridas antes del inicio. El salón queda libre y
                  los pagos se conservan en la cuenta: lo abonado no se reintegra.
                </p>
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

        <div className={pestaniaVisible === 'pagos' ? 'space-y-4' : 'hidden'}>{pagos}</div>
      </div>
    </div>
  );
}
