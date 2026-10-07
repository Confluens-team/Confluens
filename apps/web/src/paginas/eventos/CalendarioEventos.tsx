import type { EventoAgenda } from '@confluens/shared';
import type { EventContentArg, EventInput } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';

import { fechaISO, fechaLocal, nombreCompleto } from '@/lib/formato';
import { ESTADOS } from './estado-evento';

// Un evento Reservado o Cobrado siempre tiene horario (lo fija agendar()), pero un EnConsulta o un
// Cancelado pueden no tenerlo: esos se muestran en la franja "Sin horario" de la fecha pedida.
//
// `inicio` y `fin` son instantes y viajan en UTC: el calendario los pasa a hora local solo. `fecha`,
// en cambio, es una fecha de calendario que llega como medianoche UTC, y tomarla tal cual dejaba al
// evento un día antes en Argentina: por eso pasa por fechaLocal().
function comoEventoDelCalendario(evento: EventoAgenda): EventInput {
  const { color } = ESTADOS[evento.estado];
  const salon = evento.salon ? `Salón ${evento.salon.nombre}` : 'Salón a definir';
  return {
    id: String(evento.id),
    title: salon,
    start: evento.inicio ?? fechaLocal(evento.fecha),
    end: evento.fin ?? undefined,
    allDay: !evento.inicio,
    backgroundColor: color,
    borderColor: color,
    textColor: '#f6f1ea', // crema
    extendedProps: {
      salon,
      cliente: nombreCompleto(evento.cliente),
      personas: evento.cantidadPersonas,
    },
  };
}

// El título por defecto es una sola línea: se reemplaza para que cada evento muestre el horario, el
// salón, el cliente y la cantidad de personas, que es lo que pide el criterio 1.
function ContenidoEvento(arg: EventContentArg) {
  const { salon, cliente, personas } = arg.event.extendedProps as {
    salon: string;
    cliente: string;
    personas: number;
  };
  return (
    <div className="overflow-hidden px-0.5 leading-tight">
      <p className="truncate text-[0.7rem] font-semibold">
        {arg.timeText && <span className="font-normal opacity-80">{arg.timeText} </span>}
        {salon}
      </p>
      <p className="truncate text-[0.65rem] opacity-90">
        {cliente} · {personas} personas
      </p>
    </div>
  );
}

// Calendario de la agenda (HU-15), con las vistas mensual, semanal y diaria. No decide qué eventos
// trae: los recibe ya filtrados y avisa por onRango qué ventana de fechas quedó visible, para que
// el contenedor se la pase a la API al cambiar de mes o de vista.
export function CalendarioEventos({
  eventos,
  onAbrirEvento,
  onRango,
}: {
  eventos: EventoAgenda[];
  onAbrirEvento: (id: number) => void;
  onRango: (desde: string, hasta: string) => void;
}) {
  return (
    <div className="calendario-agenda rounded-xl bg-card p-3 ring-1 ring-border sm:p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locale={esLocale}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
        // Por defecto omite los minutos en punto y muestra "18" en lugar de "18:00".
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        events={eventos.map(comoEventoDelCalendario)}
        // Sin esto la vista mensual dibuja los eventos con horario como un punto de color y texto
        // suelto, y el color del estado —que es lo que los distingue— casi no se ve.
        eventDisplay="block"
        eventContent={ContenidoEvento}
        eventClick={(click) => {
          click.jsEvent.preventDefault();
          onAbrirEvento(Number(click.event.id));
        }}
        // activeEnd es exclusivo y la API toma `hasta` inclusive: se pide un día menos.
        datesSet={({ view }) => {
          const ultimoDia = new Date(view.activeEnd);
          ultimoDia.setDate(ultimoDia.getDate() - 1);
          onRango(fechaISO(view.activeStart), fechaISO(ultimoDia));
        }}
        // El día entero, sin recortar: un evento de noche puede terminar pasada la medianoche y
        // acotar la franja horaria lo dejaría pegado al borde, en un horario que no es el suyo. La
        // vista arranca scrolleada a la mañana para no abrir en medio de la madrugada.
        scrollTime="09:00:00"
        // Los eventos sin horario (EnConsulta, o un Cancelado que nunca se agendó) caen en esta
        // franja; si se la saca, desaparecen de las vistas semanal y diaria.
        allDayText="Sin horario"
        nowIndicator
        dayMaxEvents={3} // con más de 3 en un día aparece "+N más", que los despliega
        // Alto fijo para que la grilla horaria scrollee por dentro en vez de estirar la página con
        // las 24 horas, y para que el calendario no cambie de tamaño al pasar de mes.
        height={720}
        expandRows
      />
    </div>
  );
}
