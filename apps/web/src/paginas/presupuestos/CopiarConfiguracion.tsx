import type {
  EstadoEvento,
  EventoAgenda,
  EventoDetallado,
  RespuestaExito,
} from '@confluens/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCopy, Search, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState } from 'react';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { Input } from '@/components/ui/input';
import { useAgenda } from '@/hooks/use-eventos';
import { apiFetch } from '@/lib/api';
import {
  armadoDeSalones,
  fechaLocal,
  formatearFecha,
  nombreCompleto,
  nombresDeSalones,
} from '@/lib/formato';
import { cn } from '@/lib/utils';
import { ESTADOS } from '@/paginas/eventos/estado-evento';

const TODOS_LOS_ESTADOS: EstadoEvento[] = ['EnConsulta', 'Reservado', 'Cobrado', 'Cancelado'];

// Cada palabra tiene que aparecer en el cliente, en los salones o en el armado: «auditorio mesas»
// encuentra los eventos del Auditorio armados en mesas de trabajo.
function coincide(evento: EventoAgenda, busqueda: string): boolean {
  const texto = [
    nombreCompleto(evento.cliente),
    evento.cliente.etiqueta?.nombre ?? '',
    ...evento.salones.map((s) => `${s.nombre} ${s.distribucion?.nombre ?? ''}`),
  ]
    .join(' ')
    .toLocaleLowerCase('es');
  return busqueda
    .toLocaleLowerCase('es')
    .split(/\s+/)
    .filter(Boolean)
    .every((palabra) => texto.includes(palabra));
}

// HU-24, desde la consulta abierta: elegir un evento cualquiera (de este cliente o de otro) para
// copiar su configuración en el formulario. Solo elige y trae el detalle; lo que se copia y cómo lo
// decide el formulario, y nada se guarda hasta «Guardar».
export function CopiarConfiguracion({
  eventoActualId,
  abierto,
  onCambiarAbierto,
  onElegido,
}: {
  eventoActualId: number;
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
  onElegido: (evento: EventoDetallado) => void;
}) {
  const queryClient = useQueryClient();
  const eventos = useAgenda({ estado: TODOS_LOS_ESTADOS }, abierto);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const lista = (eventos.data ?? [])
    .filter((e) => e.id !== eventoActualId && coincide(e, busqueda))
    // Los más recientes primero: es lo que más se repite.
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  async function elegir(id: number) {
    setCargando(id);
    setError(false);
    try {
      const evento = await queryClient.fetchQuery({
        queryKey: ['eventos', id],
        queryFn: async () =>
          (await apiFetch<RespuestaExito<EventoDetallado>>(`/eventos/${id}`)).data,
      });
      onElegido(evento);
      onCambiarAbierto(false);
    } catch {
      setError(true);
    } finally {
      setCargando(null);
    }
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={onCambiarAbierto}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bordo-oscuro/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-papel p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-heading text-lg font-medium">
                Copiar configuración de otro evento
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Se copian los salones, la jornada, las personas, los servicios y los adicionales, a
                precios vigentes. La fecha, la hora y el cliente de esta consulta no cambian, y nada
                se guarda hasta que toques «Guardar».
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              aria-label="Buscar evento"
              placeholder="Buscar por cliente, salón o armado"
              className="pl-8"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {error && (
            <p className="mt-3 text-sm text-destructive">
              No se pudo traer ese evento. Probá de nuevo.
            </p>
          )}

          <ul className="mt-3 min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border bg-card">
            {eventos.isLoading && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando…</li>
            )}
            {eventos.isError && (
              <li className="px-4 py-6 text-center text-sm text-destructive">
                No se pudieron cargar los eventos.
              </li>
            )}
            {eventos.data && lista.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay eventos que coincidan.
              </li>
            )}
            {lista.map((evento) => {
              const estado = ESTADOS[evento.estado];
              return (
                <li key={evento.id}>
                  <button
                    type="button"
                    disabled={cargando !== null}
                    onClick={() => void elegir(evento.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {nombresDeSalones(evento.salones, 'Sin salón')}
                        {armadoDeSalones(evento.salones) && (
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            · {armadoDeSalones(evento.salones)}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {nombreCompleto(evento.cliente)} ·{' '}
                        {formatearFecha(fechaLocal(evento.fecha))} · {evento.cantidadPersonas}{' '}
                        personas
                      </p>
                    </div>
                    <BadgeTipoEvento evento={evento} />
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                        estado.clase,
                      )}
                    >
                      {estado.etiqueta}
                    </span>
                    <ClipboardCopy
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground',
                        cargando === evento.id && 'animate-pulse text-bordo',
                      )}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
