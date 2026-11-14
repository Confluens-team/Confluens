import type { EventoDetallado } from '@confluens/shared';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

import { VentanaFormulario } from '@/components/VentanaFormulario';
import { Button } from '@/components/ui/button';
import { useAgendarEvento } from '@/hooks/use-eventos';
import { ErrorApiCliente } from '@/lib/api';
import { useHorarioDelEvento } from './use-horario-del-evento';

/**
 * El horario del evento y la distribución de cada salón (RN-09: el Responsable de Eventos los
 * modifica en todo momento). Es el lápiz que está al lado del horario en los datos del evento: el
 * formulario del pago ya no los pide, así que se cargan acá antes de cobrar la seña (ADR 0007).
 * Agendar no cambia el estado del evento.
 */
export function EditorDeHorario({ evento }: { evento: EventoDetallado }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Editar el horario y la distribución"
        title="Editar el horario y la distribución"
        onClick={() => setAbierto(true)}
      >
        <Pencil />
      </Button>
      <VentanaFormulario
        abierto={abierto}
        onCambiarAbierto={setAbierto}
        titulo="Horario y distribución"
        descripcion={
          evento.estado === 'EnConsulta'
            ? 'Hay que cargarlos antes de cobrar la seña: sin horario no se puede reservar el salón. Guardarlos no reserva nada.'
            : 'Al cambiarlos se controla de nuevo que el salón esté libre en cada horario.'
        }
      >
        {/* El formulario se monta recién al abrir: así siempre arranca con lo último guardado. */}
        <FormularioDeHorario evento={evento} onTerminar={() => setAbierto(false)} />
      </VentanaFormulario>
    </>
  );
}

function FormularioDeHorario({
  evento,
  onTerminar,
}: {
  evento: EventoDetallado;
  onTerminar: () => void;
}) {
  const agendarEvento = useAgendarEvento(evento.id);
  const horario = useHorarioDelEvento(evento);
  const errorAgendar =
    agendarEvento.isError &&
    (agendarEvento.error instanceof ErrorApiCliente
      ? agendarEvento.error.message
      : 'No se pudo guardar el horario del evento.');

  return (
    <div className="space-y-4">
      {horario.campos}
      {errorAgendar && (
        <p role="alert" className="text-sm whitespace-pre-line text-destructive">
          {errorAgendar}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={!horario.completo || !horario.cambio || agendarEvento.isPending}
          onClick={() => agendarEvento.mutate(horario.datos(), { onSuccess: onTerminar })}
        >
          {agendarEvento.isPending ? 'Guardando…' : 'Guardar horario'}
        </Button>
        <Button type="button" variant="ghost" onClick={onTerminar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
