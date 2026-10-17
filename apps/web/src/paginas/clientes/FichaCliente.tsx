import type { EventoReutilizado } from '@confluens/shared';
import { ArrowLeft, CalendarDays, Mail, Phone } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useCliente } from '@/hooks/use-clientes';
import { useEtiquetas } from '@/hooks/use-etiquetas';
import { formatearFecha, nombreCompleto } from '@/lib/formato';
import { DetalleEvento } from '@/paginas/eventos/DetalleEvento';
import { EditarConsulta } from '@/paginas/presupuestos/EditarConsulta';

import { EditorDatosCliente } from './EditorDatosCliente';
import { EditorEtiqueta, ID_LISTA_ETIQUETAS } from './EditorEtiqueta';
import { HistorialCliente } from './HistorialCliente';

const cantidad = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

// HU-16 C4: la ficha de un cliente, que se abre desde el listado. Muestra sus datos de contacto, si
// tiene cuenta en el canal público y su etiqueta interna, que se puede cambiar desde acá igual que
// desde el listado. Debajo, su historial de eventos (HU-18): cada evento abre su detalle y desde
// ahí su presupuesto, y se vuelve a la ficha por el mismo camino, como en la agenda.
export function FichaCliente({ clienteId, onVolver }: { clienteId: number; onVolver: () => void }) {
  const cliente = useCliente(clienteId);
  const etiquetas = useEtiquetas();
  const [eventoAbierto, setEventoAbierto] = useState<number | null>(null);
  const [presupuestoAbierto, setPresupuestoAbierto] = useState<number | null>(null);
  // HU-24: la consulta nueva se abre como cualquier presupuesto del historial, y «Volver» lleva al
  // evento nuevo.
  const abrirReutilizada = ({ consulta }: EventoReutilizado) => {
    setEventoAbierto(consulta.evento.id);
    setPresupuestoAbierto(consulta.id);
  };

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
      />
    );
  }

  if (eventoAbierto !== null) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => setEventoAbierto(null)}>
          <ArrowLeft /> Volver a la ficha del cliente
        </Button>
        <DetalleEvento
          key={eventoAbierto}
          eventoId={eventoAbierto}
          onVerPresupuesto={setPresupuestoAbierto}
          onConsultaReutilizada={abrirReutilizada}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onVolver}>
        <ArrowLeft /> Volver a los clientes
      </Button>

      {cliente.isLoading && <p className="text-sm text-muted-foreground">Cargando el cliente…</p>}
      {cliente.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo cargar el cliente.
        </p>
      )}

      {cliente.data && (
        <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-border">
          <datalist id={ID_LISTA_ETIQUETAS}>
            {etiquetas.data?.map((etiqueta) => (
              <option key={etiqueta.id} value={etiqueta.nombre} />
            ))}
          </datalist>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{nombreCompleto(cliente.data)}</h2>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" /> Cliente desde el{' '}
                {formatearFecha(new Date(cliente.data.creadoEn))}
              </p>
            </div>
            {cliente.data.usuarioId ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                Registrado en la web
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Sin cuenta en la web
              </span>
            )}
          </div>

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Contacto</dt>
              <dd className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" /> {cliente.data.correo}
              </dd>
              <dd className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-muted-foreground" /> {cliente.data.telefono}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Etiqueta</dt>
              <dd className="mt-0.5">
                <EditorEtiqueta
                  clienteId={cliente.data.id}
                  etiqueta={cliente.data.etiqueta}
                  existentes={etiquetas.data ?? []}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Actividad</dt>
              <dd>
                {cantidad(cliente.data.cantidadEventos, 'evento', 'eventos')} ·{' '}
                {cantidad(cliente.data.cantidadSolicitudes, 'solicitud', 'solicitudes')}
              </dd>
            </div>
          </dl>

          <EditorDatosCliente cliente={cliente.data} />
        </section>
      )}

      {cliente.data && (
        <HistorialCliente
          clienteId={cliente.data.id}
          onAbrirEvento={setEventoAbierto}
          onConsultaReutilizada={abrirReutilizada}
        />
      )}
    </div>
  );
}
