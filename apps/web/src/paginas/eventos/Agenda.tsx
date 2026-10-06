import type { EventoAgenda } from '@confluens/shared';
import { ArrowLeft, CalendarDays, Clock, Users } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAgenda } from '@/hooks/use-eventos';
import { fechaLocal, formatearPesos, nombreCompleto } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { DetalleEvento } from './DetalleEvento';

type Filtro = 'todos' | 'reservado' | 'cobrado';

// Ya no existe el caso "Reservado con la seña pendiente": la reserva la dispara el pago que cruza
// el 20% de la base de cobro (HU-13), así que todo evento Reservado tiene la seña cobrada. Lo que
// distingue la agenda es cuánto falta pagar: Reservado (al menos el 20%) o Cobrado (el 100%).
function situacion(evento: EventoAgenda): Exclude<Filtro, 'todos'> {
  return evento.estado === 'Cobrado' ? 'cobrado' : 'reservado';
}

const ETIQUETAS: Record<Exclude<Filtro, 'todos'>, { texto: string; clase: string }> = {
  reservado: { texto: 'Reservado', clase: 'bg-emerald-100 text-emerald-900' },
  cobrado: { texto: 'Cobrado', clase: 'bg-bordo/10 text-bordo' },
};

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'reservado', texto: 'Reservado' },
  { valor: 'cobrado', texto: 'Cobrado' },
];

const hora = (instante: string | null) =>
  instante
    ? new Date(instante).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
    : null;

// Agenda del panel del administrador: los eventos que ocupan un salón (Reservado y Cobrado),
// agrupados por mes. Al abrir uno se muestra su detalle (HU-15), desde donde se agenda el horario,
// se registran los pagos o se cancela.
export function Agenda() {
  const agenda = useAgenda();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [eventoAbierto, setEventoAbierto] = useState<number | null>(null);

  if (eventoAbierto !== null) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-6 pt-6">
          <Button variant="ghost" size="sm" onClick={() => setEventoAbierto(null)}>
            <ArrowLeft /> Volver a la agenda
          </Button>
        </div>
        <DetalleEvento eventoId={eventoAbierto} />
      </div>
    );
  }

  const eventos = (agenda.data ?? []).filter((e) => filtro === 'todos' || situacion(e) === filtro);
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
      <div className="flex flex-wrap gap-2">
        {FILTROS.map(({ valor, texto }) => {
          const cantidad =
            valor === 'todos'
              ? (agenda.data?.length ?? 0)
              : (agenda.data ?? []).filter((e) => situacion(e) === valor).length;
          return (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                filtro === valor ? 'border-bordo bg-bordo text-crema' : 'border-border bg-card',
              )}
            >
              {texto} <span className="ml-1 opacity-70">{cantidad}</span>
            </button>
          );
        })}
      </div>

      {agenda.isLoading && <p className="text-sm text-muted-foreground">Cargando la agenda…</p>}
      {agenda.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo cargar la agenda.
        </p>
      )}
      {agenda.data && eventos.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <CalendarDays className="mx-auto size-8 text-dorado" />
          <p className="mt-3 font-medium">No hay eventos para mostrar</p>
          <p className="text-sm text-muted-foreground">
            Los eventos aparecen acá cuando se reservan desde una consulta.
          </p>
        </div>
      )}

      {[...porMes].map(([mes, delMes]) => (
        <section key={mes}>
          <h3 className="mb-3 text-xs font-semibold tracking-[0.2em] text-dorado uppercase first-letter:uppercase">
            {mes}
          </h3>
          <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
            {delMes.map((evento) => {
              const fecha = fechaLocal(evento.fecha);
              const etiqueta = ETIQUETAS[situacion(evento)];
              const desde = hora(evento.inicio);
              const hasta = hora(evento.fin);
              return (
                <li key={evento.id}>
                  <button
                    type="button"
                    onClick={() => setEventoAbierto(evento.id)}
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
                        Salón {evento.salon.nombre}
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
                          etiqueta.clase,
                        )}
                      >
                        {etiqueta.texto}
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
