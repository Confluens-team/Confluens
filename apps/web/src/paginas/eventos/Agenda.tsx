import {
  ESTADOS_QUE_OCUPAN_SALON,
  horaDelEvento,
  type EstadoEvento,
  type EventoAgenda,
} from '@confluens/shared';
import { ArrowLeft, CalendarDays, Clock, Users } from 'lucide-react';
import { Popover } from 'radix-ui';
import { type ReactNode, useState } from 'react';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { EtiquetaCliente } from '@/components/EtiquetaCliente';
import { Button } from '@/components/ui/button';
import { IconoEstado } from '@/components/IconoEstado';
import { useAgenda } from '@/hooks/use-eventos';
import { useSalones } from '@/hooks/use-salones';
import { fechaLocal, formatearPesos, hoyISO, nombreCompleto } from '@/lib/formato';
import { armadoDeSalones, nombresDeSalones } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { CalendarioEventos } from './CalendarioEventos';
import { EditarConsulta } from '@/paginas/presupuestos/EditarConsulta';

import { ComandaEvento } from './ComandaEvento';
import { DetalleEvento } from './DetalleEvento';
import { ESTADOS, ESTADOS_DEL_FILTRO } from './estado-evento';
import { TarjetaResumenEvento } from './TarjetaResumenEvento';

export type VistaAgenda = 'calendario' | 'lista';

const hora = (instante: string | null) => (instante ? horaDelEvento(instante) : null);

// Chip de filtro: se usa igual para los salones y para los estados.
function Chip({
  activo,
  onClick,
  title,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
        activo ? 'border-bordo bg-bordo text-crema' : 'border-border bg-card hover:bg-muted/60',
      )}
    >
      {children}
    </button>
  );
}

// La lista de siempre: los eventos agrupados por mes, con el detalle a un clic. Convive con el
// calendario porque para "¿qué hay en noviembre?" se lee de un tirón, sin pasar de día en día.
function ListaDeEventos({
  eventos,
  seleccionadoId,
  onSeleccionar,
}: {
  eventos: EventoAgenda[];
  seleccionadoId: number | null;
  onSeleccionar: (id: number, ancla: HTMLElement) => void;
}) {
  const porMes = new Map<string, EventoAgenda[]>();
  for (const evento of eventos) {
    const mes = fechaLocal(evento.fecha).toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    });
    porMes.set(mes, [...(porMes.get(mes) ?? []), evento]);
  }

  return (
    <div className="space-y-6">
      {[...porMes].map(([mes, delMes]) => (
        <section key={mes}>
          <h3 className="mb-3 text-xs font-semibold tracking-[0.2em] text-dorado-texto uppercase first-letter:uppercase">
            {mes}
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {delMes.map((evento) => {
              const fecha = fechaLocal(evento.fecha);
              const estado = ESTADOS[evento.estado];
              const desde = hora(evento.inicio);
              const hasta = hora(evento.fin);
              return (
                <li key={evento.id}>
                  <button
                    type="button"
                    onClick={(click) => onSeleccionar(evento.id, click.currentTarget)}
                    aria-expanded={seleccionadoId === evento.id}
                    className={cn(
                      'flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                      seleccionadoId === evento.id && 'bg-muted/60',
                    )}
                  >
                    <div className="w-12 shrink-0 text-center">
                      <p className="font-serif text-2xl leading-none font-semibold text-bordo">
                        {fecha.getDate()}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground uppercase">
                        {fecha.toLocaleDateString('es-AR', { weekday: 'short' })}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {evento.salones.length > 1 ? 'Salones' : 'Salón'}{' '}
                        {nombresDeSalones(evento.salones, 'a definir')}
                        {armadoDeSalones(evento.salones) && (
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            · {armadoDeSalones(evento.salones)}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {nombreCompleto(evento.cliente)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <BadgeTipoEvento evento={evento} />
                        <EtiquetaCliente etiqueta={evento.cliente.etiqueta} />
                      </div>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {desde && hasta && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" /> {desde} a {hasta}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" /> {evento.cantidadPersonas} personas
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          estado.clase,
                        )}
                      >
                        <IconoEstado estado={evento.estado} />
                        {estado.etiqueta}
                      </span>
                      {evento.totalPresupuesto && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatearPesos(evento.totalPresupuesto)} sin IVA
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Agenda de eventos del personal interno (HU-15). El calendario (mensual, semanal y diaria) y la
// lista por mes muestran los mismos eventos ya filtrados por la API; al tocar uno se abre su
// resumen sobre la agenda, y desde ahí el detalle completo: el presupuesto vigente, los pagos y la
// cancelación.
//
// El clic no cambia de pantalla a propósito: casi siempre se mira la agenda para ubicar un evento
// entre varios, y perder el mes que se estaba recorriendo para leer cuatro datos obligaba a volver
// y a buscarlo de nuevo.
//
// Por defecto se ven los estados que ocupan el salón: así una franja sin eventos en un salón se
// lee como disponible aunque haya consultas EnConsulta sobre ella (criterio 5), y los Cancelado
// quedan afuera hasta que se los pida (criterio 2). Tres eventos el mismo día y horario en salones
// distintos se ven los tres: el filtro de salón es opcional y acepta varios a la vez.
/**
 * La agenda de eventos en una de sus dos vistas. Cada una es su propia pestaña del panel: «Agenda»
 * es el calendario y «Eventos» la lista agrupada por mes (decisión de Franco, 16/10/2026). Antes
 * convivían en la misma pestaña con un conmutador.
 */
export function Agenda({ vista }: { vista: VistaAgenda }) {
  const [salonId, setSalonId] = useState<number[]>([]);
  const [estado, setEstado] = useState<EstadoEvento[]>([...ESTADOS_QUE_OCUPAN_SALON]);
  // Ventana visible del calendario; la manda él mismo al cambiar de mes o de vista.
  const [rango, setRango] = useState<{ desde: string; hasta: string } | null>(null);
  const [eventoAbierto, setEventoAbierto] = useState<number | null>(null);
  // El evento cuyo resumen está abierto, con el elemento al que se le ancla la tarjeta y de dónde
  // salió (de eso depende de qué lado abrirla). Se guarda el id y no el evento: la agenda se
  // refresca sola y así la tarjeta muestra siempre la última versión.
  const [resumen, setResumen] = useState<{
    id: number;
    ancla: HTMLElement;
    origen: VistaAgenda;
  } | null>(null);
  // Dónde quedó parado el calendario. FullCalendar se desmonta al abrir el detalle, así que sin
  // esto volvería siempre al mes de hoy en la vista mensual.
  const [posicion, setPosicion] = useState({ fecha: hoyISO(), vista: 'dayGridMonth' });
  // HU-15 → HU-11: desde el evento se abre el detalle de su presupuesto.
  const [presupuestoAbierto, setPresupuestoAbierto] = useState<number | null>(null);
  // Comanda de cocina del evento confirmado, para imprimir. Tiene prioridad sobre las otras dos
  // vistas: se abre tanto desde el detalle del evento como desde el del presupuesto.
  const [comandaAbierta, setComandaAbierta] = useState<number | null>(null);

  const salones = useSalones();
  const enCalendario = vista === 'calendario';
  // La lista no acota por fechas: muestra la agenda completa agrupada por mes. El calendario, en
  // cambio, pide solo lo que entra en la ventana visible, y hasta saber cuál es no pide nada.
  const agenda = useAgenda(
    {
      ...(enCalendario && rango ? rango : {}),
      salonId: salonId.length > 0 ? salonId : undefined,
      estado,
    },
    !enCalendario || rango !== null,
  );

  function alternarSalon(id: number) {
    setResumen(null);
    setSalonId((actuales) =>
      actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id],
    );
  }

  // Sin ningún estado elegido la API devolvería igual los que ocupan el salón, y la pantalla
  // quedaría mintiendo: se deja siempre al menos uno.
  function alternarEstado(valor: EstadoEvento) {
    setResumen(null);
    setEstado((actuales) => {
      const siguientes = actuales.includes(valor)
        ? actuales.filter((otro) => otro !== valor)
        : [...actuales, valor];
      return siguientes.length > 0 ? siguientes : actuales;
    });
  }

  if (comandaAbierta !== null) {
    return (
      <ComandaEvento presupuestoId={comandaAbierta} onVolver={() => setComandaAbierta(null)} />
    );
  }

  if (eventoAbierto !== null && presupuestoAbierto !== null) {
    const volverAlEvento = () => setPresupuestoAbierto(null);
    return (
      <EditarConsulta
        key={presupuestoAbierto}
        id={presupuestoAbierto}
        textoVolver="Volver al evento"
        textoVolverAlGuardar="Volver al evento"
        onVolver={volverAlEvento}
        onGuardada={volverAlEvento}
        onDadaDeBaja={volverAlEvento}
        onAbrirEvento={volverAlEvento}
        onImprimirComanda={setComandaAbierta}
      />
    );
  }

  if (eventoAbierto !== null) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => setEventoAbierto(null)}>
          <ArrowLeft /> {enCalendario ? 'Volver a la agenda' : 'Volver a los eventos'}
        </Button>
        <DetalleEvento
          eventoId={eventoAbierto}
          onVerPresupuesto={setPresupuestoAbierto}
          onImprimirComanda={setComandaAbierta}
        />
      </div>
    );
  }

  const eventos = agenda.data ?? [];
  const eventoDelResumen = resumen ? (eventos.find(({ id }) => id === resumen.id) ?? null) : null;

  function verEventoCompleto(id: number) {
    setResumen(null);
    setEventoAbierto(id);
  }

  return (
    <div className="space-y-5">
      {agenda.isFetching && (
        <p className="text-right text-xs text-muted-foreground">Actualizando…</p>
      )}

      <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-dorado-texto uppercase">
            Salones
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip activo={salonId.length === 0} onClick={() => setSalonId([])}>
              Todos
            </Chip>
            {(salones.data ?? []).map((salon) => (
              <Chip
                key={salon.id}
                activo={salonId.includes(salon.id)}
                onClick={() => alternarSalon(salon.id)}
              >
                {salon.nombre}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-dorado-texto uppercase">
            Estado
          </p>
          <div className="flex flex-wrap gap-2">
            {ESTADOS_DEL_FILTRO.map((valor) => (
              <Chip
                key={valor}
                activo={estado.includes(valor)}
                onClick={() => alternarEstado(valor)}
                title={ESTADOS[valor].ayuda}
              >
                {/* Aro crema alrededor del punto: sobre el chip activo, que es bordó, un punto
                    oscuro se pierde (el negro da 1.57:1) y el crema lo despega. Sobre el chip
                    inactivo el aro queda invisible contra la tarjeta, que es lo que se busca. Es
                    `ring` y no `border` porque el borde le comería 2px al color dentro de un punto
                    de 8px. */}
                <span
                  className="size-2 rounded-full ring-1 ring-crema"
                  style={{ backgroundColor: ESTADOS[valor].color }}
                />
                <IconoEstado estado={valor} />
                {ESTADOS[valor].etiqueta}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {agenda.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo cargar la agenda.
        </p>
      )}

      {vista === 'calendario' ? (
        <CalendarioEventos
          eventos={eventos}
          seleccionadoId={eventoDelResumen?.id ?? null}
          fechaVisible={posicion.fecha}
          vistaVisible={posicion.vista}
          onSeleccionar={(id, ancla) => setResumen({ id, ancla, origen: 'calendario' })}
          onRango={(desde, hasta) => setRango({ desde, hasta })}
          onPosicion={(fecha, vista) => setPosicion({ fecha, vista })}
        />
      ) : agenda.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando la agenda…</p>
      ) : eventos.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <CalendarDays className="mx-auto size-8 text-dorado" />
          <p className="mt-3 font-medium">No hay eventos para mostrar</p>
          <p className="text-sm text-muted-foreground">
            Probá con otros salones o estados. Los eventos aparecen acá cuando se reservan desde una
            consulta.
          </p>
        </div>
      ) : (
        <ListaDeEventos
          eventos={eventos}
          seleccionadoId={eventoDelResumen?.id ?? null}
          onSeleccionar={(id, ancla) => setResumen({ id, ancla, origen: 'lista' })}
        />
      )}

      {/* El resumen del evento, anclado al evento que se tocó. El Popover de radix ya trae cerrar
          con Esc y con un clic afuera, y el foco vuelve solo. virtualRef apunta al elemento tal
          cual, así la tarjeta lo sigue si la página scrollea. */}
      <Popover.Root
        open={eventoDelResumen !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setResumen(null);
        }}
      >
        {resumen && <Popover.Anchor virtualRef={{ current: resumen.ancla }} />}
        <Popover.Portal>
          {/* Al costado del evento en el calendario, que es angosto y deja lugar; debajo y a la
              derecha de la fila de la lista, que ocupa todo el ancho y no deja ninguno. */}
          <Popover.Content
            side={resumen?.origen === 'lista' ? 'bottom' : 'right'}
            align={resumen?.origen === 'lista' ? 'end' : 'start'}
            sideOffset={8}
            collisionPadding={16}
            className="z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-xl bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-border"
          >
            {eventoDelResumen && (
              <TarjetaResumenEvento
                evento={eventoDelResumen}
                onCerrar={() => setResumen(null)}
                onVerEvento={() => verEventoCompleto(eventoDelResumen.id)}
              />
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
