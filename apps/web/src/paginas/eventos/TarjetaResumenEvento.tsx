import type { EventoAgenda } from '@confluens/shared';
import { ArrowRight, CalendarDays, Clock, LayoutGrid, Users, X } from 'lucide-react';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { Button } from '@/components/ui/button';
import { fechaLocal, nombreCompleto, nombresDeSalones } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { ESTADOS } from './estado-evento';

// En 24 horas, como el calendario y la lista que están abajo: la tarjeta se lee junto a ellos y
// "06:00" al lado de "6:00 a. m." se lee como dos horarios distintos.
// "15 nov 2026": la fecha completa de formatearFecha no entra en media tarjeta de 380 px y se
// cortaba en "15 de noviembre de 20…".
const formateadorFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' });
const formateadorHora = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Iniciales para el avatar: nombre y apellido, o las dos primeras palabras cuando el cliente es una
// razón social (apellido es null, ver nombreCompleto en lib/formato).
function iniciales(cliente: EventoAgenda['cliente']): string {
  const palabras = cliente.apellido
    ? [cliente.nombre, cliente.apellido]
    : cliente.nombre.split(' ').filter(Boolean);
  return palabras
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');
}

// El horario real si el evento ya está agendado; si no, la hora estimada que dejó la consulta, que
// es de referencia (ADR 0007). Un EnConsulta puede no tener ni eso.
function horario(evento: EventoAgenda): string {
  if (evento.inicio && evento.fin) {
    return `${formateadorHora.format(new Date(evento.inicio))} a ${formateadorHora.format(new Date(evento.fin))}`;
  }
  return evento.horaInicioEstimada ? `estimado ${evento.horaInicioEstimada}` : 'Sin agendar';
}

// tipoJornada no se puede derivar de inicio/fin (tipo-evento.esquema.ts): la elige el cliente. Los
// eventos anteriores a esa columna no la tienen y acá no hay presupuesto del que sacarla.
const JORNADAS = { media: 'Media jornada', completa: 'Jornada completa' } as const;

function Dato({
  icono: Icono,
  etiqueta,
  children,
}: {
  icono: typeof Users;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icono className="size-3.5 shrink-0" aria-hidden /> {etiqueta}
      </p>
      <p className="mt-0.5 truncate text-sm">{children}</p>
    </div>
  );
}

/**
 * Resumen del evento que se abre sobre la agenda al hacer clic en uno (HU-15). Es solo de lectura:
 * lo justo para saber si ese es el evento que se buscaba —quién, dónde, cuándo— sin perder el mes
 * que se estaba mirando. Todo lo demás (cuenta, pagos, presupuesto, cancelación) está en
 * DetalleEvento, a un clic de "Ver evento completo".
 */
export function TarjetaResumenEvento({
  evento,
  onCerrar,
  onVerEvento,
}: {
  evento: EventoAgenda;
  onCerrar: () => void;
  onVerEvento: () => void;
}) {
  const estado = ESTADOS[evento.estado];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-medium">Evento #{evento.id}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              title={estado.ayuda}
              className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', estado.clase)}
            >
              {estado.etiqueta}
            </span>
            <BadgeTipoEvento evento={evento} />
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar el resumen"
          className="-mt-1 -mr-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 border-t pt-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bordo/10 font-heading text-sm font-medium text-bordo"
        >
          {iniciales(evento.cliente)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{nombreCompleto(evento.cliente)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {evento.cliente.telefono} · {evento.cliente.correo}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
        <Dato icono={Users} etiqueta="Salón">
          {nombresDeSalones(evento.salones)} · {evento.cantidadPersonas} personas
        </Dato>
        <Dato icono={CalendarDays} etiqueta="Fecha">
          {formateadorFecha.format(fechaLocal(evento.fecha))}
        </Dato>
        <Dato icono={Clock} etiqueta="Hora">
          {horario(evento)}
        </Dato>
        <Dato icono={LayoutGrid} etiqueta="Jornada">
          {evento.tipoJornada ? JORNADAS[evento.tipoJornada] : 'Sin especificar'}
        </Dato>
      </div>

      <Button className="w-full" onClick={onVerEvento}>
        Ver evento completo <ArrowRight />
      </Button>
    </div>
  );
}
