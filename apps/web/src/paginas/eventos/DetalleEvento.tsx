import { type EstadoEvento, veAuditoria } from '@confluens/shared';
import { Check, FileText, History, Printer, Repeat2, Wallet, XCircle } from 'lucide-react';
import { useState } from 'react';

import { formatearFechaNumerica } from '@/lib/formato';
import { textoDeDias } from '@/lib/rango-de-fechas';
import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { BotonWhatsApp } from '@/components/BotonWhatsApp';
import { Pestanias } from '@/components/Pestanias';
import { TarjetaCliente } from '@/components/TarjetaCliente';
import { Button } from '@/components/ui/button';
import { IconoEstado } from '@/components/IconoEstado';
import { useCancelarEvento, useEvento } from '@/hooks/use-eventos';
import { useArmarPresupuestoDeEvento, useConsulta } from '@/hooks/use-presupuestos';
import { useSesion } from '@/hooks/use-sesion';
import { ErrorApiCliente } from '@/lib/api';
import { cn } from '@/lib/utils';
import { mensajeWhatsApp } from '@/lib/whatsapp';
import { DiasDelEvento } from './DiasDelEvento';
import { DisposicionConPagos } from './DisposicionConPagos';
import { ESTADOS } from './estado-evento';
import { presupuestoVigenteDe } from './presupuesto-vigente';
import { ReutilizarConfiguracion } from './ReutilizarConfiguracion';
import { HistorialDelRegistro } from '@/paginas/auditoria/HistorialDelRegistro';
import { PresupuestoFormal } from '@/paginas/presupuestos/PresupuestoFormal';
import { SeguimientoConsulta } from '@/paginas/presupuestos/SeguimientoConsulta';

// Las pestañas del detalle de un evento (15/11/2026). Historial solo para el GG y el ADM.
type PestaniaDeEvento = 'detalle' | 'pagos' | 'historial';

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

interface DetalleEventoProps {
  eventoId: number;
  // HU-11: abre el detalle completo del presupuesto (líneas, IVA, vigencia y los demás del evento).
  onVerPresupuesto?: (presupuestoId: number) => void;
  // Comanda de cocina del evento confirmado: la hoja sin precios que se imprime y se cuelga.
  onImprimirComanda?: (presupuestoId: number) => void;
  // HU-24: abre la consulta nueva creada con «Repetir evento». Sin esto, el botón no aparece.
  onAbrirConsulta?: (presupuestoId: number, eventoId: number) => void;
}

// Vista central del evento. El título (número, estado, tipo, fecha y avance) queda en todas las
// pestañas, con las pestañas arriba a la derecha (15/11/2026). Debajo, los datos del cliente con
// WhatsApp y el PDF (cada uno con su check) y las acciones. La pestaña Detalle muestra la cinta de
// días y el día elegido (HU-50, docs/diseno/panel-evento-cinta-de-dias.md); la pestaña Pagos es el
// cobro: el formulario a la izquierda y la cuenta a la derecha. Agendar va en el mismo formulario del
// pago, que agenda y cobra de una vez; el evento sigue EnConsulta hasta que los pagos cruzan el 20%
// de la base de cobro (HU-13).
export function DetalleEvento({
  eventoId,
  onVerPresupuesto,
  onImprimirComanda,
  onAbrirConsulta,
}: DetalleEventoProps) {
  const { data: evento, isLoading, isError } = useEvento(eventoId);
  const cancelarEvento = useCancelarEvento(eventoId);
  const armarPresupuesto = useArmarPresupuestoDeEvento(eventoId);
  const [repitiendo, setRepitiendo] = useState(false);
  // Detalle, Pagos o Historial. El Historial (diseño D) lo ven solo los roles que ven la auditoría.
  const [pestania, setPestania] = useState<PestaniaDeEvento>('detalle');
  // El presupuesto en PDF para mandárselo al cliente. El resto queda montado (oculto) para no
  // perder lo que se estaba editando.
  const [documentoAbierto, setDocumentoAbierto] = useState(false);
  const { data: sesion } = useSesion();
  const veHistorial = !!sesion && veAuditoria(sesion.rol);
  const pestaniaVisible: PestaniaDeEvento =
    pestania === 'historial' && !veHistorial ? 'detalle' : pestania;
  const presupuestoVigente = evento ? presupuestoVigenteDe(evento) : undefined;
  // La consulta del presupuesto vigente: el seguimiento (aviso y envío) y el PDF salen de ahí.
  const consulta = useConsulta(presupuestoVigente?.id);

  if (isLoading) return <p className="py-6 text-sm text-muted-foreground">Cargando…</p>;
  if (isError || !evento) {
    return <p className="py-6 text-sm text-destructive">No se pudo cargar el evento.</p>;
  }

  const estado = ESTADOS[evento.estado];
  // Sin base de cobro: el presupuesto vacío de una consulta social (ADR 0008).
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

  // Las fechas pueden llegar con hora (medianoche UTC): se comparan como días de calendario.
  const primerDia = evento.fecha.slice(0, 10);
  const ultimoDia = (evento.dias[evento.dias.length - 1]?.fecha ?? evento.fecha).slice(0, 10);
  const fechaDelEvento =
    ultimoDia !== primerDia
      ? `Del ${formatearFechaNumerica(primerDia)} al ${formatearFechaNumerica(ultimoDia)} · ${textoDeDias(primerDia, ultimoDia)}`
      : formatearFechaNumerica(primerDia);
  const sePuedeCancelar = evento.estado === 'EnConsulta' || evento.estado === 'Reservado';

  // Lo que se ofrece en Pagos cuando todavía no hay base de cobro. Armar el presupuesto solo tiene
  // sentido con el evento en consulta: el que se crea nace Estimado y la API rechaza un Estimado
  // sobre un evento ya reservado, cobrado o cancelado. El sin armar ya existe, así que solo se abre.
  const accionSinPresupuesto = (
    <>
      {armarPresupuesto.isError && (
        <p className="text-destructive">
          {armarPresupuesto.error instanceof ErrorApiCliente
            ? armarPresupuesto.error.message
            : 'No se pudo armar el presupuesto.'}
        </p>
      )}
      {(presupuestoSinArmar || evento.estado === 'EnConsulta') && onVerPresupuesto && (
        <Button
          variant="outline"
          size="sm"
          disabled={armarPresupuesto.isPending}
          onClick={armarElPresupuesto}
        >
          {armarPresupuesto.isPending ? 'Armando…' : 'Armar el presupuesto'}
        </Button>
      )}
    </>
  );

  const tarjetaCliente = (
    <TarjetaCliente
      nombre={evento.cliente.nombre}
      correo={evento.cliente.correo}
      telefono={evento.cliente.telefono}
      etiqueta={evento.cliente.etiqueta}
    >
      {/* WhatsApp y el PDF, cada uno con su check. Sin presupuesto no hay seguimiento: solo
          WhatsApp. */}
      {consulta.data ? (
        <SeguimientoConsulta consulta={consulta.data} onDescargar={() => alternarDocumento(true)} />
      ) : (
        <BotonWhatsApp
          telefono={evento.cliente.telefono}
          mensaje={mensajeWhatsApp(evento.cliente.nombre, evento.estado)}
        />
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {/* HU-24: solo se repite un evento Cobrado (decisión de Franco, 17/10/2026). */}
        {onAbrirConsulta && evento.estado === 'Cobrado' && (
          <Button variant="outline" size="sm" onClick={() => setRepitiendo(true)}>
            <Repeat2 /> Repetir evento
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
            <XCircle /> {evento.estado === 'Reservado' ? 'Cancelar evento' : 'Cancelar consulta'}
          </Button>
        )}
      </div>
      {/* El rechazo de la API (por ejemplo, RN-07 con menos de 48 horas). */}
      {cancelarEvento.isError && (
        <p role="alert" className="text-sm text-destructive">
          {cancelarEvento.error instanceof ErrorApiCliente
            ? cancelarEvento.error.message
            : 'No se pudo cancelar el evento.'}
        </p>
      )}
    </TarjetaCliente>
  );

  function alternarDocumento(abierto: boolean) {
    setDocumentoAbierto(abierto);
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      {documentoAbierto && consulta.data && (
        <PresupuestoFormal consulta={consulta.data} onVolver={() => alternarDocumento(false)} />
      )}
      {/* Todo el evento vive en un solo panel: el beige de la paleta con un filete dorado, y
          adentro las tarjetas como hojas apoyadas sobre él. */}
      <div
        className={
          documentoAbierto
            ? 'hidden'
            : 'space-y-5 rounded-2xl bg-secondary/80 p-4 ring-1 ring-dorado/25 sm:p-6'
        }
      >
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
            onAbrirConsulta={({ consulta: nueva }) => onAbrirConsulta(nueva.id, nueva.evento.id)}
          />
        )}

        {pestaniaVisible === 'historial' && <HistorialDelRegistro eventoId={evento.id} />}

        {/* Detalle y Pagos se ocultan, no se desmontan: el horario o las observaciones que se
            estaban editando no se pierden al cambiar de pestaña. */}
        <div className={pestaniaVisible === 'historial' ? 'hidden' : undefined}>
          <DisposicionConPagos
            eventoId={evento.id}
            pagos={pestaniaVisible === 'pagos'}
            cliente={tarjetaCliente}
            accionSinPresupuesto={accionSinPresupuesto}
          >
            <DiasDelEvento evento={evento} onVerPresupuesto={onVerPresupuesto} />
          </DisposicionConPagos>
        </div>
      </div>
    </>
  );
}
