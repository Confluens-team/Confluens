import {
  desglosarIva,
  type EstadoEvento,
  type EventoReutilizado,
  type FiltrosHistorialCliente,
} from '@confluens/shared';
import { Copy } from 'lucide-react';
import { useState } from 'react';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconoEstado } from '@/components/IconoEstado';
import { useHistorialCliente } from '@/hooks/use-clientes';
import { fechaLocal, formatearFecha, formatearPesos } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { ESTADOS, ESTADOS_DEL_FILTRO } from '@/paginas/eventos/estado-evento';
import { ReutilizarConfiguracion } from '@/paginas/eventos/ReutilizarConfiguracion';

// HU-18: el historial de eventos y consultas de un cliente, dentro de su ficha. Muestra todos los
// estados (Cancelado incluido), del más reciente al más antiguo, con un resumen por estado que no
// depende de los filtros. Cada fila abre el detalle del evento, y desde ahí su presupuesto (HU-11).
export function HistorialCliente({
  clienteId,
  onAbrirEvento,
  onConsultaReutilizada,
}: {
  clienteId: number;
  onAbrirEvento: (eventoId: number) => void;
  // HU-24: abre la consulta nueva que se creó al reutilizar un evento de la lista.
  onConsultaReutilizada: (resultado: EventoReutilizado) => void;
}) {
  const [aReutilizar, setAReutilizar] = useState<number | null>(null);
  const [estado, setEstado] = useState<EstadoEvento[]>([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  // Un rango invertido lo rechaza la API (400): no se pide hasta que se corrija.
  const rangoInvalido = !!desde && !!hasta && desde > hasta;
  const filtros: FiltrosHistorialCliente = rangoInvalido ? { estado } : { estado, desde, hasta };
  const historial = useHistorialCliente(clienteId, filtros);

  const hayFiltros = estado.length > 0 || !!desde || !!hasta;
  function alternarEstado(valor: EstadoEvento) {
    setEstado((actual) =>
      actual.includes(valor) ? actual.filter((e) => e !== valor) : [...actual, valor],
    );
  }

  const resumen = historial.data?.resumen;
  const totalEventos = resumen ? Object.values(resumen).reduce((a, b) => a + b, 0) : 0;
  const eventos = historial.data?.eventos ?? [];

  return (
    <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-border">
      <h3 className="text-base font-semibold">Historial de eventos</h3>

      {/* C5: el resumen por estado es de todos los eventos del cliente, con o sin filtros. Cada
          estado es también el filtro: tocarlo muestra solo los de ese estado. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {ESTADOS_DEL_FILTRO.map((valor) => (
          <button
            key={valor}
            type="button"
            aria-pressed={estado.includes(valor)}
            onClick={() => alternarEstado(valor)}
            title={ESTADOS[valor].ayuda}
            aria-label={`${ESTADOS[valor].etiqueta}: ${resumen?.[valor] ?? 0} eventos`}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors',
              estado.includes(valor)
                ? cn(ESTADOS[valor].clase, 'ring-current')
                : 'bg-background text-muted-foreground ring-border hover:text-foreground',
            )}
          >
            <IconoEstado estado={valor} className="-mr-1" />
            {ESTADOS[valor].etiqueta}
            <span className="tabular-nums">{resumen?.[valor] ?? '–'}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="historial-desde">Evento desde</Label>
          <Input
            id="historial-desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="historial-hasta">Evento hasta</Label>
          <Input
            id="historial-hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            aria-invalid={rangoInvalido}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          disabled={!hayFiltros}
          onClick={() => {
            setEstado([]);
            setDesde('');
            setHasta('');
          }}
        >
          Limpiar filtros
        </Button>
      </div>
      {rangoInvalido && (
        <p className="text-sm text-destructive">
          La fecha hasta no puede ser anterior a la fecha desde.
        </p>
      )}

      {historial.isLoading && <p className="text-sm text-muted-foreground">Cargando historial…</p>}
      {historial.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo cargar el historial del cliente.
        </p>
      )}

      {historial.data && totalEventos === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Este cliente todavía no tiene eventos.
        </p>
      )}
      {historial.data && totalEventos > 0 && eventos.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Ningún evento del cliente cumple los filtros.
        </p>
      )}

      {eventos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Salón</th>
                <th className="px-3 py-2 text-right font-semibold">Personas</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 text-right font-semibold">Total con IVA</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {eventos.map((evento) => (
                <tr key={evento.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onAbrirEvento(evento.id)}
                      className="text-left font-medium text-bordo underline-offset-2 hover:underline"
                      aria-label={`Ver el evento ${evento.id}`}
                    >
                      {formatearFecha(fechaLocal(evento.fecha))}
                    </button>
                    <p className="text-xs text-muted-foreground">Evento #{evento.id}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <BadgeTipoEvento evento={evento} />
                  </td>
                  <td className="px-3 py-2.5">
                    {evento.salones.length > 0 ? (
                      evento.salones.map(({ nombre }) => nombre).join(', ')
                    ) : (
                      <span className="text-muted-foreground italic">Sin salón asignado</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{evento.cantidadPersonas}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        ESTADOS[evento.estado].clase,
                      )}
                    >
                      <IconoEstado estado={evento.estado} />
                      {ESTADOS[evento.estado].etiqueta}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {evento.total === null ? '—' : formatearPesos(desglosarIva(evento.total).total)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAReutilizar(evento.id)}
                      aria-label={`Reutilizar la configuración del evento ${evento.id}`}
                    >
                      <Copy /> Reutilizar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aReutilizar !== null && (
        <ReutilizarConfiguracion
          key={aReutilizar}
          eventoId={aReutilizar}
          abierto
          onCambiarAbierto={(abierto) => !abierto && setAReutilizar(null)}
          onAbrirConsulta={onConsultaReutilizada}
        />
      )}
    </section>
  );
}
