import { horaDelEvento } from '@confluens/shared';
import { AlertTriangle } from 'lucide-react';

import { useChoquesDeConsulta } from '@/hooks/use-presupuestos';
import { fechaLocal, formatearFecha } from '@/lib/formato';

// Aviso preventivo de solapamientos (HU-50, RN-12): al armar o revisar una consulta, los salones que
// otro evento ya tiene reservado en alguno de sus días, con su horario. La consulta no bloquea el
// salón, pero un choque en cualquier día impide reservar el evento entero: el Responsable de Eventos
// lo ve acá, antes de intentar reservar, y puede hablar con el cliente para cambiar el día, el
// horario o el salón. El cliente en el canal público no ve este aviso. Lista TODOS los choques.
export function AvisoDeChoques({ consultaId }: { consultaId: number }) {
  const choques = useChoquesDeConsulta(consultaId);
  if (!choques.data || choques.data.choques.length === 0) return null;

  const { dias, choques: lista } = choques.data;
  const diasConChoque = new Set(lista.map((choque) => choque.fecha)).size;

  return (
    <div
      role="status"
      className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-2 ring-amber-300"
    >
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        {dias === 1
          ? 'Este día tiene un salón ocupado por otro evento'
          : `${diasConChoque} de los ${dias} días tienen un salón ocupado por otro evento`}
      </p>
      <ul className="mt-3 space-y-1.5">
        {lista.map((choque) => (
          <li key={`${choque.fecha}-${choque.salon.id}-${choque.evento.id}`}>
            <span className="font-medium first-letter:uppercase">
              {formatearFecha(fechaLocal(choque.fecha), true)}
            </span>{' '}
            · Salón {choque.salon.nombre}: reservado por el evento #{choque.evento.id} (
            {choque.evento.cliente}
            {choque.evento.inicio && choque.evento.fin
              ? `, de ${horaDelEvento(choque.evento.inicio)} a ${horaDelEvento(choque.evento.fin)}`
              : ''}
            ).
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs">
        La consulta no bloquea el salón, pero no se va a poder reservar mientras haya un choque en
        cualquier día.{' '}
        {dias > 1 && diasConChoque < dias
          ? `Los otros ${dias - diasConChoque} días están libres. `
          : ''}
        Hablá con el cliente para mover el día, el horario o el salón.
      </p>
    </div>
  );
}
