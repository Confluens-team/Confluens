import { desglosarIva, type EstadoConsulta, type FiltrosPresupuestos } from '@confluens/shared';
import { AlertTriangle, CheckCircle2, FileText, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePresupuestos } from '@/hooks/use-presupuestos';
import { fechaLocal, formatearPesos, nombreCompleto } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { EditarConsulta } from './EditarConsulta';

// Los Confirmado no aparecen: pasan a la agenda de eventos.
const ESTADOS: { valor: EstadoConsulta; clase: string }[] = [
  { valor: 'Estimado', clase: 'bg-muted text-foreground' },
  { valor: 'Expirado', clase: 'bg-amber-100 text-amber-900' },
  { valor: 'Cancelado', clase: 'bg-bordo/10 text-bordo' },
];

const claseDeEstado = (estado: string) => ESTADOS.find((e) => e.valor === estado)?.clase ?? '';

const fechaCorta = (fecha: Date) =>
  fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// En la columna de vigencia el año va con dos dígitos para que la tabla entre sin scroll.
const fechaCompacta = (fecha: Date) =>
  fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });

// HU-10: las consultas del personal (cada una es un presupuesto no confirmado), de la más reciente a
// la más antigua por emisión. Filtra por estado, cliente y rango de fechas del evento; las Expirado
// llevan el aviso de RN-08. Los importes se guardan sin IVA y se muestran desglosados (RN-05). Cada
// fila abre la consulta para editarla (HU-12).
export function ListadoConsultas() {
  const [estado, setEstado] = useState<EstadoConsulta | undefined>();
  const [textoCliente, setTextoCliente] = useState('');
  const [cliente, setCliente] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [abierta, setAbierta] = useState<number | null>(null);
  // Lo que pasó con la última consulta que se cerró (guardada o dada de baja).
  const [aviso, setAviso] = useState<string | null>(null);

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

  // HU-12: cada fila abre la consulta para verla y editarla; al guardar o dar de baja se vuelve
  // al listado, arriba de todo, con el aviso de lo que pasó.
  function cerrar(mensaje: string | null) {
    setAbierta(null);
    setAviso(mensaje);
    window.scrollTo({ top: 0 });
  }

  if (abierta !== null) {
    return (
      <EditarConsulta
        key={abierta}
        id={abierta}
        onVolver={() => cerrar(null)}
        onGuardada={(consulta) =>
          cerrar(
            `Consulta ${consulta.id} guardada: queda Estimado hasta el ${fechaCorta(new Date(consulta.venceEn))}.`,
          )
        }
        onDadaDeBaja={(consulta) => cerrar(`Consulta ${consulta.id} dada de baja.`)}
      />
    );
  }

  const lista = presupuestos.data ?? [];

  return (
    <div className="space-y-6">
      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" /> {aviso}
          </p>
          <button type="button" aria-label="Cerrar el aviso" onClick={() => setAviso(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}
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
        <p className="text-sm text-muted-foreground">Cargando las consultas…</p>
      )}
      {presupuestos.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudieron cargar las consultas.
        </p>
      )}

      {presupuestos.data && lista.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <FileText className="mx-auto size-8 text-dorado" />
          {hayFiltros ? (
            <>
              <p className="mt-3 font-medium">Ninguna consulta cumple los filtros</p>
              <p className="text-sm text-muted-foreground">
                Probá con otro estado, cliente o rango de fechas.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            </>
          ) : (
            <>
              <p className="mt-3 font-medium">Todavía no hay consultas</p>
              <p className="text-sm text-muted-foreground">
                Aparecen acá cuando un cliente pide un presupuesto desde la landing.
              </p>
            </>
          )}
        </div>
      )}

      {lista.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {lista.length} {lista.length === 1 ? 'consulta' : 'consultas'} · de la más reciente a la
            más antigua
          </p>
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Nº</th>
                  <th className="px-3 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Salón</th>
                  <th className="px-3 py-3 font-medium">Evento</th>
                  <th className="px-3 py-3 font-medium">Vigencia</th>
                  <th className="px-3 py-3 text-right font-medium">Subtotal</th>
                  <th className="px-3 py-3 text-right font-medium">IVA 21%</th>
                  <th className="px-3 py-3 text-right font-medium">Total</th>
                  <th className="w-40 px-3 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((presupuesto) => {
                  const expirado = presupuesto.estado === 'Expirado';
                  const importes = desglosarIva(presupuesto.total);
                  return (
                    <tr
                      key={presupuesto.id}
                      onClick={() => setAbierta(presupuesto.id)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/60',
                        expirado && 'bg-amber-50/70',
                      )}
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="font-medium text-bordo underline-offset-2 hover:underline"
                          aria-label={`Ver la consulta ${presupuesto.id}`}
                        >
                          {presupuesto.id}
                        </button>
                      </td>
                      <td className="max-w-[10rem] px-3 py-3">
                        <p className="truncate font-medium">
                          {nombreCompleto(presupuesto.cliente)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {presupuesto.cliente.correo}
                        </p>
                      </td>
                      <td className="px-3 py-3">{presupuesto.salon.nombre}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {fechaCorta(fechaLocal(presupuesto.fechaEvento))}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <p>
                          <span className="text-xs text-muted-foreground">Emitida </span>
                          {fechaCompacta(new Date(presupuesto.fechaEmision))}
                        </p>
                        <p>
                          <span className="text-xs text-muted-foreground">Vence </span>
                          {fechaCompacta(new Date(presupuesto.venceEn))}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {formatearPesos(importes.subtotal)}
                        <p className="text-xs text-muted-foreground">sin IVA</p>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {formatearPesos(importes.iva)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap">
                        {formatearPesos(importes.total)}
                        <p className="text-xs font-normal text-muted-foreground">con IVA</p>
                      </td>
                      <td className="px-3 py-3">
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
