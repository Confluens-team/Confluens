import {
  hoyEnZonaEventos,
  MAXIMO_PERSONAS_EVENTO,
  type EventoReutilizado,
  type TipoJornada,
} from '@confluens/shared';
import { AlertTriangle, CheckCircle2, Copy, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState } from 'react';

import { InputEntero } from '@/components/InputEntero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReutilizarEvento } from '@/hooks/use-eventos';
import { ErrorApiCliente } from '@/lib/api';
import { fechaLocal, formatearFecha } from '@/lib/formato';

// El día siguiente a hoy en Córdoba (ADR 0010): la fecha del evento nuevo tiene que ser futura.
function manana(): string {
  const hoy = new Date(`${hoyEnZonaEventos()}T12:00:00.000Z`);
  hoy.setUTCDate(hoy.getUTCDate() + 1);
  return hoy.toISOString().slice(0, 10);
}

// HU-24: «Reutilizar en una consulta nueva». Lo propio del cliente no se copia del evento original
// (equipo, 17/10/2026): se pide, como en el cotizador, la fecha, las personas, la jornada y, si se
// quiere, una hora de inicio aproximada; el horario exacto se carga después, al agendar (ADR 0007).
// La API crea la consulta con los salones y su armado, el tipo de evento, los servicios con su
// modalidad y los adicionales, a precios vigentes, con las cantidades por defecto y sin horas. Al
// terminar, el diálogo avisa lo que no se pudo copiar y los salones que ese día ya están
// reservados (RN-12), y ofrece abrir la consulta nueva.
export function ReutilizarConfiguracion({
  eventoId,
  abierto,
  onCambiarAbierto,
  onAbrirConsulta,
}: {
  eventoId: number;
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
  onAbrirConsulta: (resultado: EventoReutilizado) => void;
}) {
  const reutilizar = useReutilizarEvento(eventoId);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [personas, setPersonas] = useState('');
  const [jornada, setJornada] = useState<TipoJornada>('completa');
  const minimo = manana();
  const fechaValida = !!fecha && fecha >= minimo;
  const personasValidas = Number(personas) > 0;

  // Al abrir se arranca de cero: un resultado anterior ya se usó.
  function cambiarAbierto(abrir: boolean) {
    if (abrir) {
      reutilizar.reset();
      setFecha('');
      setHora('');
      setPersonas('');
      setJornada('completa');
    }
    onCambiarAbierto(abrir);
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!fechaValida || !personasValidas) return;
    reutilizar.mutate({
      fecha,
      cantidadPersonas: Number(personas),
      tipoJornada: jornada,
      horaInicioEstimada: hora || undefined,
    });
  }

  const resultado = reutilizar.data;

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiarAbierto}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bordo-oscuro/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-papel p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-heading text-lg font-medium">
                {resultado ? 'Consulta creada' : 'Reutilizar en una consulta nueva'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {resultado
                  ? `La consulta ${resultado.consulta.id} quedó en consulta, con un presupuesto Estimado a precios vigentes. El evento #${eventoId} no cambió.`
                  : `Se crea una consulta nueva para el mismo cliente con los salones, el armado, el tipo de evento y los servicios del evento #${eventoId}, a precios vigentes. Los datos del evento nuevo los cargás acá.`}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {resultado ? (
            <Resultado
              resultado={resultado}
              onAbrir={() => {
                onCambiarAbierto(false);
                onAbrirConsulta(resultado);
              }}
            />
          ) : (
            <form onSubmit={enviar} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reutilizar-fecha">Fecha del evento nuevo</Label>
                  <Input
                    id="reutilizar-fecha"
                    type="date"
                    min={minimo}
                    required
                    value={fecha}
                    aria-invalid={!!fecha && !fechaValida}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                  {fecha && !fechaValida && (
                    <p className="text-xs text-destructive">La fecha tiene que ser futura.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reutilizar-hora">Hora aproximada (opcional)</Label>
                  <Input
                    id="reutilizar-hora"
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reutilizar-personas">Personas</Label>
                  <InputEntero
                    id="reutilizar-personas"
                    max={MAXIMO_PERSONAS_EVENTO}
                    required
                    value={personas}
                    onChangeValor={setPersonas}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reutilizar-jornada">Jornada</Label>
                  <select
                    id="reutilizar-jornada"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    value={jornada}
                    onChange={(e) => setJornada(e.target.value as TipoJornada)}
                  >
                    <option value="completa">Jornada completa</option>
                    <option value="media">Media jornada (hasta 4 h)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Los servicios entran para todas las personas (o 1 si no se cobra por persona) y sin
                hora: después los ajustás en la consulta. El horario exacto se carga al agendar.
              </p>

              {reutilizar.isError && (
                <p className="text-sm text-destructive">
                  {reutilizar.error instanceof ErrorApiCliente
                    ? reutilizar.error.message
                    : 'No se pudo crear la consulta.'}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t pt-4">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">
                    Cancelar
                  </Button>
                </Dialog.Close>
                <Button
                  type="submit"
                  disabled={!fechaValida || !personasValidas || reutilizar.isPending}
                >
                  <Copy /> {reutilizar.isPending ? 'Creando…' : 'Crear consulta'}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Resultado({ resultado, onAbrir }: { resultado: EventoReutilizado; onAbrir: () => void }) {
  const { consulta, serviciosOmitidos, salonesEnConflicto } = resultado;
  return (
    <div className="mt-5 space-y-3 text-sm">
      <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-900">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>
          Para el {formatearFecha(fechaLocal(consulta.evento.fecha), true)}. Vence en 10 días, como
          cualquier presupuesto estimado.
        </span>
      </p>
      {serviciosOmitidos.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            No se copiaron porque ya no están en el catálogo:{' '}
            {serviciosOmitidos.map((s) => s.nombre).join(', ')}.
          </span>
        </p>
      )}
      {/* RN-12: la consulta no bloquea el salón; el que seña primero se lo queda. */}
      {salonesEnConflicto.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            En conflicto: ese día{' '}
            {salonesEnConflicto.length === 1
              ? `el salón ${salonesEnConflicto[0]!.nombre} ya tiene`
              : `los salones ${salonesEnConflicto.map((s) => s.nombre).join(', ')} ya tienen`}{' '}
            un evento reservado. Revisá con el cliente la fecha, el horario o el salón.
          </span>
        </p>
      )}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Dialog.Close asChild>
          <Button type="button" variant="ghost">
            Cerrar
          </Button>
        </Dialog.Close>
        <Button type="button" onClick={onAbrir}>
          Abrir la consulta {consulta.id}
        </Button>
      </div>
    </div>
  );
}
