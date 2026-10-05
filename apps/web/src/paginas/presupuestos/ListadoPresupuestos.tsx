import type { EstadoPresupuesto, FiltrosPresupuestos, PresupuestoListado } from '@confluens/shared';
import { AlertTriangle, ArrowLeft, FileText, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePresupuestos } from '@/hooks/use-presupuestos';
import { fechaLocal, formatearPesos, nombreCompleto } from '@/lib/formato';
import { desglosarIva } from '@/lib/importes';
import { cn } from '@/lib/utils';
import { DetalleEvento } from '@/paginas/eventos/DetalleEvento';

const ESTADOS: { valor: EstadoPresupuesto; clase: string }[] = [
  { valor: 'Estimado', clase: 'bg-muted text-foreground' },
  { valor: 'Confirmado', clase: 'bg-emerald-100 text-emerald-900' },
  { valor: 'Cancelado', clase: 'bg-bordo/10 text-bordo' },
  { valor: 'Expirado', clase: 'bg-amber-100 text-amber-900' },
];

const claseDeEstado = (estado: EstadoPresupuesto) =>
  ESTADOS.find((e) => e.valor === estado)?.clase ?? '';

const fechaCorta = (fecha: Date) =>
  fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// RN-05: se guarda sin IVA y se muestra el total con IVA.
const totalConIva = (presupuesto: PresupuestoListado) =>
  formatearPesos(desglosarIva(presupuesto.total).total);

// HU-10: listado de presupuestos del personal, del más reciente al más antiguo por emisión. Filtra
// por estado, cliente y rango de fechas del evento; los Expirado llevan el aviso de RN-08. Hasta
// que exista el detalle del presupuesto (HU-11), cada fila abre el detalle de su evento.
export function ListadoPresupuestos() {
  const [estado, setEstado] = useState<EstadoPresupuesto | undefined>();
  const [textoCliente, setTextoCliente] = useState('');
  const [cliente, setCliente] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [eventoAbierto, setEventoAbierto] = useState<number | null>(null);

  // La búsqueda por cliente espera a que se deje de escribir para no pedir una vez por tecla.
  useEffect(() => {
    const espera = setTimeout(() => setCliente(textoCliente.trim()), 300);
    return () => clearTimeout(espera);
  }, [textoCliente]);

  // Un rango invertido lo rechaza la API (400): no se pide hasta que se corrija.
  const rangoInvalido = !!desde && !!hasta && desde > hasta;
  const filtros: FiltrosPresupuestos = rangoInvalido
    ? { estado, cliente }
    : { estado, cliente, desde, hasta };
  const presupuestos = usePresupuestos(filtros);

  const hayFiltros = !!estado || !!textoCliente.trim() || !!desde || !!hasta;
  function limpiarFiltros() {
    setEstado(undefined);
    setTextoCliente('');
    setCliente('');
    setDesde('');
    setHasta('');
  }

  if (eventoAbierto !== null) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-6 pt-6">
          <Button variant="ghost" size="sm" onClick={() => setEventoAbierto(null)}>
            <ArrowLeft /> Volver a los presupuestos
          </Button>
        </div>
        <DetalleEvento eventoId={eventoAbierto} />
      </div>
    );
  }

  const lista = presupuestos.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[
            { valor: undefined, texto: 'Todos' },
            ...ESTADOS.map((e) => ({ valor: e.valor, texto: e.valor })),
          ].map(({ valor, texto }) => (
            <button
              key={texto}
              type="button"
              onClick={() => setEstado(valor)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                estado === valor ? 'border-bordo bg-bordo text-crema' : 'border-border bg-card',
              )}
            >
              {texto}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-cliente">Cliente</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filtro-cliente"
                className="bg-card pl-8"
                placeholder="Nombre, apellido o correo"
                value={textoCliente}
                onChange={(e) => setTextoCliente(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-desde">Evento desde</Label>
            <Input
              id="filtro-desde"
              type="date"
              className="bg-card"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-hasta">Evento hasta</Label>
            <Input
              id="filtro-hasta"
              type="date"
              className="bg-card"
              value={hasta}
              min={desde || undefined}
              aria-invalid={rangoInvalido}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={limpiarFiltros} disabled={!hayFiltros}>
            Limpiar filtros
          </Button>
        </div>
        {rangoInvalido && (
          <p className="text-sm text-destructive">
            La fecha hasta no puede ser anterior a la fecha desde.
          </p>
        )}
      </div>

      {presupuestos.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando los presupuestos…</p>
      )}
      {presupuestos.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudieron cargar los presupuestos.
        </p>
      )}

      {presupuestos.data && lista.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <FileText className="mx-auto size-8 text-dorado" />
          {hayFiltros ? (
            <>
              <p className="mt-3 font-medium">Ningún presupuesto cumple los filtros</p>
              <p className="text-sm text-muted-foreground">
                Probá con otro estado, cliente o rango de fechas.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            </>
          ) : (
            <>
              <p className="mt-3 font-medium">Todavía no hay presupuestos</p>
              <p className="text-sm text-muted-foreground">
                Aparecen acá cuando se genera uno desde una consulta.
              </p>
            </>
          )}
        </div>
      )}

      {lista.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {lista.length} {lista.length === 1 ? 'presupuesto' : 'presupuestos'} · del más reciente
            al más antiguo
          </p>
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nº</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Salón</th>
                  <th className="px-4 py-3 font-medium">Evento</th>
                  <th className="px-4 py-3 font-medium">Emisión</th>
                  <th className="px-4 py-3 font-medium">Vence</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="w-48 px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((presupuesto) => {
                  const expirado = presupuesto.estado === 'Expirado';
                  return (
                    <tr
                      key={presupuesto.id}
                      onClick={() => setEventoAbierto(presupuesto.eventoId)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/60',
                        expirado && 'bg-amber-50/70',
                      )}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="font-medium text-bordo underline-offset-2 hover:underline"
                          aria-label={`Ver el presupuesto ${presupuesto.id}`}
                        >
                          {presupuesto.id}
                        </button>
                      </td>
                      <td className="max-w-[14rem] px-4 py-3">
                        <p className="truncate font-medium">
                          {nombreCompleto(presupuesto.cliente)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {presupuesto.cliente.correo}
                        </p>
                      </td>
                      <td className="px-4 py-3">{presupuesto.salon.nombre}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {fechaCorta(fechaLocal(presupuesto.fechaEvento))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {fechaCorta(new Date(presupuesto.fechaEmision))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {fechaCorta(new Date(presupuesto.venceEn))}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {totalConIva(presupuesto)}
                        <p className="text-xs text-muted-foreground">IVA incluido</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            claseDeEstado(presupuesto.estado),
                          )}
                        >
                          {presupuesto.estado}
                        </span>
                        {expirado && (
                          <p className="mt-1 flex items-start gap-1 text-xs font-medium text-amber-900">
                            <AlertTriangle className="mt-px size-3 shrink-0" />
                            Presupuesto vencido, recalcular
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
