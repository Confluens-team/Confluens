import { ESTADOS_QUE_OCUPAN_SALON, type EstadoEvento, type EventoAgenda } from '@confluens/shared';
import { ArrowLeft, CalendarDays, Clock, List, Users } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { Button } from '@/components/ui/button';
import { useAgenda } from '@/hooks/use-eventos';
import { useSalones } from '@/hooks/use-salones';
import { fechaLocal, formatearPesos, nombreCompleto } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { CalendarioEventos } from './CalendarioEventos';
import { EditarConsulta } from '@/paginas/presupuestos/EditarConsulta';

import { DetalleEvento } from './DetalleEvento';
import { ESTADOS, ESTADOS_DEL_FILTRO } from './estado-evento';

type Vista = 'calendario' | 'lista';

const hora = (instante: string | null) =>
  instante
    ? new Date(instante).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    : null;

// Chip de filtro: se usa igual para los salones, los estados y el conmutador de vista.
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
  onAbrirEvento,
}: {
  eventos: EventoAgenda[];
  onAbrirEvento: (id: number) => void;
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
                    onClick={() => onAbrirEvento(evento.id)}
                    className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/60"
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
                        {evento.salon ? `Salón ${evento.salon.nombre}` : 'Salón a definir'}
                        {evento.distribucion && (
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            · {evento.distribucion.nombre}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {nombreCompleto(evento.cliente)}
                      </p>
                      <BadgeTipoEvento evento={evento} className="mt-1" />
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
                          'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          estado.clase,
                        )}
                      >
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
// lista por mes muestran los mismos eventos ya filtrados por la API; al abrir uno se llega a su
// detalle, y desde ahí al presupuesto vigente, a los pagos y a la cancelación.
//
// Por defecto se ven los estados que ocupan el salón: así una franja sin eventos en un salón se
// lee como disponible aunque haya consultas EnConsulta sobre ella (criterio 5), y los Cancelado
// quedan afuera hasta que se los pida (criterio 2). Tres eventos el mismo día y horario en salones
// distintos se ven los tres: el filtro de salón es opcional y acepta varios a la vez.
export function Agenda() {
  const [vista, setVista] = useState<Vista>('calendario');
  const [salonId, setSalonId] = useState<number[]>([]);
  const [estado, setEstado] = useState<EstadoEvento[]>([...ESTADOS_QUE_OCUPAN_SALON]);
  // Ventana visible del calendario; la manda él mismo al cambiar de mes o de vista.
  const [rango, setRango] = useState<{ desde: string; hasta: string } | null>(null);
  const [eventoAbierto, setEventoAbierto] = useState<number | null>(null);
  // HU-15 → HU-11: desde el evento se abre el detalle de su presupuesto.
  const [presupuestoAbierto, setPresupuestoAbierto] = useState<number | null>(null);

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
    setSalonId((actuales) =>
      actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id],
    );
  }

  // Sin ningún estado elegido la API devolvería igual los que ocupan el salón, y la pantalla
  // quedaría mintiendo: se deja siempre al menos uno.
  function alternarEstado(valor: EstadoEvento) {
    setEstado((actuales) => {
      const siguientes = actuales.includes(valor)
        ? actuales.filter((otro) => otro !== valor)
        : [...actuales, valor];
      return siguientes.length > 0 ? siguientes : actuales;
    });
  }

  if (eventoAbierto !== null && presupuestoAbierto !== null) {
    const volverAlEvento = () => setPresupuestoAbierto(null);
    return (
      <EditarConsulta
        key={presupuestoAbierto}
        id={presupuestoAbierto}
        textoVolver="Volver al evento"
        onVolver={volverAlEvento}
        onGuardada={volverAlEvento}
        onDadaDeBaja={volverAlEvento}
        onAbrirEvento={volverAlEvento}
      />
    );
  }

  if (eventoAbierto !== null) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-6 pt-6">
          <Button variant="ghost" size="sm" onClick={() => setEventoAbierto(null)}>
            <ArrowLeft /> Volver a la agenda
          </Button>
        </div>
        <DetalleEvento eventoId={eventoAbierto} onVerPresupuesto={setPresupuestoAbierto} />
      </div>
    );
  }

  const eventos = agenda.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {(
            [
              { valor: 'calendario', texto: 'Calendario', icono: CalendarDays },
              { valor: 'lista', texto: 'Lista', icono: List },
            ] as const
          ).map(({ valor, texto, icono: Icono }) => (
            <button
              key={valor}
              type="button"
              onClick={() => setVista(valor)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                vista === valor ? 'bg-card shadow-sm' : 'text-muted-foreground',
              )}
            >
              <Icono className="size-4" /> {texto}
            </button>
          ))}
        </div>
        {agenda.isFetching && <span className="text-xs text-muted-foreground">Actualizando…</span>}
      </div>

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
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: ESTADOS[valor].color }}
                />
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
          onAbrirEvento={setEventoAbierto}
          onRango={(desde, hasta) => setRango({ desde, hasta })}
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
        <ListaDeEventos eventos={eventos} onAbrirEvento={setEventoAbierto} />
      )}
    </div>
  );
}
