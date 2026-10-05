import type {
  ConsultaDetallada,
  SalonConDistribuciones,
  Servicio,
  TipoJornada,
} from '@confluens/shared';
import { AlertTriangle, ArrowLeft, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useConsulta,
  useDarDeBajaConsulta,
  useModificarConsulta,
  useRecalcularConsulta,
} from '@/hooks/use-presupuestos';
import { useSalones } from '@/hooks/use-salones';
import { useServicios } from '@/hooks/use-servicios';
import { ErrorApiCliente } from '@/lib/api';
import { formatearPesos, nombreCompleto } from '@/lib/formato';
import { DIAS_VIGENCIA_PRESUPUESTO, desglosarIva } from '@/lib/importes';
import { cn } from '@/lib/utils';

interface LineaEditable {
  servicioId: number;
  descripcion: string;
  cantidad: string;
  precio: string;
  tercerizado: boolean;
}

const fechaCorta = (fecha: Date) =>
  fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const precioDeSalon = (salon: SalonConDistribuciones, jornada: TipoJornada) =>
  jornada === 'completa' ? salon.precioJornadaCompleta : salon.precioMediaJornada;

const esEntero = (valor: string) => /^\d+$/.test(valor) && Number(valor) > 0;
const esImporte = (valor: string) => /^\d{1,10}(\.\d{1,2})?$/.test(valor);

const mensajeDeError = (error: unknown, porDefecto: string) =>
  error instanceof ErrorApiCliente ? error.message : porDefecto;

const ESTADOS: Record<string, string> = {
  Estimado: 'bg-muted text-foreground',
  Expirado: 'bg-amber-100 text-amber-900',
  Cancelado: 'bg-bordo/10 text-bordo',
  Confirmado: 'bg-emerald-100 text-emerald-900',
};

// HU-12: una consulta abierta desde el listado. Después de hablar con el cliente, el personal
// corrige fecha, salón, personas, jornada, servicios, cantidades y precios; al guardar queda
// Estimado y la vigencia vuelve a contar 10 días. Una Expirado además se puede recalcular con los
// precios vigentes, y cualquiera en curso se puede dar de baja. Los datos del cliente son suyos:
// acá solo se muestran.
export function EditarConsulta({
  id,
  onVolver,
  onAbrir,
}: {
  id: number;
  onVolver: () => void;
  onAbrir: (id: number) => void;
}) {
  const consulta = useConsulta(id);
  const salones = useSalones();
  const servicios = useServicios();
  // Vive acá y no en el formulario, que se vuelve a armar después de guardar.
  const [guardado, setGuardado] = useState(false);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onVolver}>
        <ArrowLeft /> Volver a las consultas
      </Button>
      {(consulta.isLoading || salones.isLoading || servicios.isLoading) && (
        <p className="text-sm text-muted-foreground">Cargando la consulta…</p>
      )}
      {(consulta.isError || salones.isError || servicios.isError) && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo cargar la consulta.
        </p>
      )}
      {guardado && consulta.data && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Cambios guardados. La consulta vence el {fechaCorta(new Date(consulta.data.venceEn))}.
        </p>
      )}
      {consulta.data && salones.data && servicios.data && (
        // La key vuelve a armar el formulario con lo que guardó la API después de cada cambio.
        <Formulario
          key={`${consulta.data.id}-${consulta.data.venceEn}-${consulta.data.estado}`}
          consulta={consulta.data}
          salones={salones.data}
          catalogo={servicios.data}
          onAbrir={onAbrir}
          onGuardado={setGuardado}
        />
      )}
    </div>
  );
}

function Formulario({
  consulta,
  salones,
  catalogo,
  onAbrir,
  onGuardado,
}: {
  consulta: ConsultaDetallada;
  salones: SalonConDistribuciones[];
  catalogo: Servicio[];
  onAbrir: (id: number) => void;
  onGuardado: (guardado: boolean) => void;
}) {
  const modificar = useModificarConsulta(consulta.id);
  const recalcular = useRecalcularConsulta(consulta.id);
  const darDeBaja = useDarDeBajaConsulta(consulta.id);

  const lineaSalon = consulta.lineas.find((linea) => linea.servicioId === null);
  const [fecha, setFecha] = useState(consulta.evento.fecha);
  const [salonId, setSalonId] = useState(consulta.salon.id);
  const [jornada, setJornada] = useState<TipoJornada>(consulta.tipoJornada);
  const [personas, setPersonas] = useState(String(consulta.evento.cantidadPersonas));
  const [precioSalon, setPrecioSalon] = useState(lineaSalon?.precioUnitario ?? '0.00');
  const [lineas, setLineas] = useState<LineaEditable[]>(
    consulta.lineas
      .filter((linea) => linea.servicioId !== null)
      .map((linea) => ({
        servicioId: linea.servicioId!,
        descripcion: linea.descripcion,
        cantidad: String(linea.cantidad),
        precio: linea.precioUnitario,
        tercerizado: linea.tercerizado,
      })),
  );
  const [agregar, setAgregar] = useState('');

  const enCurso =
    (consulta.estado === 'Estimado' || consulta.estado === 'Expirado') &&
    consulta.evento.estado === 'EnConsulta';
  const expirado = consulta.estado === 'Expirado';
  const salon = salones.find((s) => s.id === salonId);

  // La línea del salón vuelve a su precio congelado si se vuelve al salón y la jornada originales;
  // si no, toma el precio vigente. Después se puede ajustar a mano.
  function cambiarSalonOJornada(nuevoSalonId: number, nuevaJornada: TipoJornada) {
    setSalonId(nuevoSalonId);
    setJornada(nuevaJornada);
    const original = nuevoSalonId === consulta.salon.id && nuevaJornada === consulta.tipoJornada;
    const nuevoSalon = salones.find((s) => s.id === nuevoSalonId);
    if (original && lineaSalon) setPrecioSalon(lineaSalon.precioUnitario);
    else if (nuevoSalon) setPrecioSalon(precioDeSalon(nuevoSalon, nuevaJornada));
  }

  function actualizarLinea(servicioId: number, cambios: Partial<LineaEditable>) {
    setLineas((anteriores) =>
      anteriores.map((l) => (l.servicioId === servicioId ? { ...l, ...cambios } : l)),
    );
  }

  // Un servicio nuevo entra con el precio vigente; si es por persona, para todas las personas.
  function agregarServicio() {
    const servicio = catalogo.find((s) => s.id === Number(agregar));
    if (!servicio) return;
    setLineas((anteriores) => [
      ...anteriores,
      {
        servicioId: servicio.id,
        descripcion: servicio.nombre,
        cantidad: servicio.porPersona && esEntero(personas) ? personas : '1',
        precio: servicio.precio,
        tercerizado: servicio.tercerizado,
      },
    ]);
    setAgregar('');
  }

  const disponibles = catalogo.filter(
    (s) => s.activo && !lineas.some((l) => l.servicioId === s.id),
  );
  const valido =
    !!fecha &&
    esEntero(personas) &&
    esImporte(precioSalon) &&
    lineas.every((l) => esEntero(l.cantidad) && esImporte(l.precio));

  // RN-05: los importes se cargan sin IVA y el resumen muestra el desglose.
  const subtotalSinIva =
    (esImporte(precioSalon) ? Number(precioSalon) : 0) +
    lineas.reduce(
      (suma, l) =>
        suma +
        (esEntero(l.cantidad) && esImporte(l.precio) ? Number(l.cantidad) * Number(l.precio) : 0),
      0,
    );
  const importes = desglosarIva(subtotalSinIva);
  const excedeCapacidad = !!salon && esEntero(personas) && Number(personas) > salon.capacidadMaxima;

  function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    onGuardado(false);
    modificar.mutate(
      {
        fecha,
        salonId,
        cantidadPersonas: Number(personas),
        tipoJornada: jornada,
        precioSalon: Number(precioSalon).toFixed(2),
        servicios: lineas.map((l) => ({
          servicioId: l.servicioId,
          cantidad: Number(l.cantidad),
          precioUnitario: Number(l.precio).toFixed(2),
        })),
      },
      { onSuccess: () => onGuardado(true) },
    );
  }

  function confirmarBaja() {
    if (!window.confirm(`¿Dar de baja la consulta ${consulta.id}? Va a quedar como Cancelado.`)) {
      return;
    }
    darDeBaja.mutate();
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-bordo">Consulta {consulta.id}</h2>
          <p className="text-sm text-muted-foreground">
            Emitida el {fechaCorta(new Date(consulta.fechaEmision))} · vence el{' '}
            {fechaCorta(new Date(consulta.venceEn))}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            ESTADOS[consulta.estado] ?? '',
          )}
        >
          {consulta.estado}
        </span>
      </header>

      {expirado && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" /> Presupuesto vencido, recalcular
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={recalcular.isPending}
            onClick={() =>
              recalcular.mutate(undefined, { onSuccess: (nuevo) => onAbrir(nuevo.id) })
            }
          >
            <RefreshCw />{' '}
            {recalcular.isPending ? 'Recalculando…' : 'Recalcular con precios vigentes'}
          </Button>
        </div>
      )}
      {recalcular.isError && (
        <p className="text-sm text-destructive">
          {mensajeDeError(recalcular.error, 'No se pudo recalcular la consulta.')}
        </p>
      )}
      {!enCurso && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          {consulta.estado === 'Cancelado'
            ? 'Esta consulta se dio de baja'
            : consulta.estado === 'Confirmado'
              ? 'Esta consulta ya se confirmó y pasó a la agenda'
              : 'El evento de esta consulta ya no está en consulta'}
          : se puede ver, pero no modificar.
        </p>
      )}

      <section className="rounded-xl bg-card p-5 ring-1 ring-border">
        <h3 className="text-sm font-semibold">Cliente</h3>
        <p className="mt-2 font-medium">{nombreCompleto(consulta.cliente)}</p>
        <p className="text-sm text-muted-foreground">
          {consulta.cliente.correo} · {consulta.cliente.telefono}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Los datos de contacto los mantiene el cliente desde su cuenta.
        </p>
      </section>

      <fieldset disabled={!enCurso} className="space-y-6">
        <section className="rounded-xl bg-card p-5 ring-1 ring-border">
          <h3 className="text-sm font-semibold">Evento</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="consulta-fecha">Fecha</Label>
              <Input
                id="consulta-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consulta-salon">Salón</Label>
              <select
                id="consulta-salon"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={salonId}
                onChange={(e) => cambiarSalonOJornada(Number(e.target.value), jornada)}
              >
                {salones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} (hasta {s.capacidadMaxima})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consulta-personas">Personas</Label>
              <Input
                id="consulta-personas"
                type="number"
                min={1}
                value={personas}
                aria-invalid={!esEntero(personas)}
                onChange={(e) => setPersonas(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consulta-jornada">Jornada</Label>
              <select
                id="consulta-jornada"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={jornada}
                onChange={(e) => cambiarSalonOJornada(salonId, e.target.value as TipoJornada)}
              >
                <option value="completa">Jornada completa</option>
                <option value="media">Media jornada (hasta 4 h)</option>
              </select>
            </div>
          </div>
          {excedeCapacidad && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-900">
              <AlertTriangle className="size-3.5" /> {personas} personas superan la capacidad del
              salón {salon.nombre} ({salon.capacidadMaxima}).
            </p>
          )}
        </section>

        <section className="rounded-xl bg-card p-5 ring-1 ring-border">
          <h3 className="text-sm font-semibold">Detalle</h3>
          <p className="text-xs text-muted-foreground">
            Precios unitarios sin IVA. Lo que ya estaba conserva su precio; lo nuevo entra con el
            vigente. Se pueden ajustar a mano.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Concepto</th>
                  <th className="w-24 pb-2 font-medium">Cantidad</th>
                  <th className="w-36 pb-2 font-medium">Precio unitario</th>
                  <th className="w-32 pb-2 text-right font-medium">Subtotal</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 pr-3">
                    Salón {salon?.nombre} (
                    {jornada === 'completa' ? 'jornada completa' : 'media jornada'})
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">1</td>
                  <td className="py-2 pr-3">
                    <Input
                      aria-label="Precio del salón"
                      inputMode="decimal"
                      value={precioSalon}
                      aria-invalid={!esImporte(precioSalon)}
                      onChange={(e) => setPrecioSalon(e.target.value)}
                    />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {esImporte(precioSalon) ? formatearPesos(precioSalon) : '—'}
                  </td>
                  <td />
                </tr>
                {lineas.map((linea) => (
                  <tr key={linea.servicioId}>
                    <td className="py-2 pr-3">
                      {linea.descripcion}
                      {linea.tercerizado && (
                        <span className="ml-1 text-xs text-muted-foreground">(tercerizado)</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Cantidad de ${linea.descripcion}`}
                        type="number"
                        min={1}
                        value={linea.cantidad}
                        aria-invalid={!esEntero(linea.cantidad)}
                        onChange={(e) =>
                          actualizarLinea(linea.servicioId, { cantidad: e.target.value })
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Precio unitario de ${linea.descripcion}`}
                        inputMode="decimal"
                        value={linea.precio}
                        aria-invalid={!esImporte(linea.precio)}
                        onChange={(e) =>
                          actualizarLinea(linea.servicioId, { precio: e.target.value })
                        }
                      />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {esEntero(linea.cantidad) && esImporte(linea.precio)
                        ? formatearPesos(Number(linea.cantidad) * Number(linea.precio))
                        : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar ${linea.descripcion}`}
                        onClick={() =>
                          setLineas((anteriores) =>
                            anteriores.filter((l) => l.servicioId !== linea.servicioId),
                          )
                        }
                      >
                        <X />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="consulta-agregar">Agregar servicio</Label>
              <select
                id="consulta-agregar"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={agregar}
                onChange={(e) => setAgregar(e.target.value)}
              >
                <option value="">Elegí un servicio…</option>
                {disponibles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} · {formatearPesos(s.precio)}
                    {s.porPersona ? ' por persona' : ''}
                    {s.tercerizado ? ' (tercerizado)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" variant="outline" disabled={!agregar} onClick={agregarServicio}>
              <Plus /> Agregar
            </Button>
          </div>
        </section>
      </fieldset>

      <section className="rounded-xl bg-card p-5 ring-1 ring-border">
        <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subtotal sin IVA</dt>
            <dd>{formatearPesos(importes.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">IVA 21%</dt>
            <dd>{formatearPesos(importes.iva)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t pt-1.5 text-base font-semibold">
            <dt>Total con IVA</dt>
            <dd>{formatearPesos(importes.total)}</dd>
          </div>
        </dl>
      </section>

      {enCurso && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={darDeBaja.isPending}
            onClick={confirmarBaja}
          >
            <Trash2 /> Dar de baja
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-xs text-muted-foreground">
              Al guardar, la vigencia vuelve a contar {DIAS_VIGENCIA_PRESUPUESTO} días.
            </p>
            <Button type="submit" disabled={!valido || modificar.isPending}>
              {modificar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      )}
      {modificar.isError && (
        <p className="text-right text-sm text-destructive">
          {mensajeDeError(modificar.error, 'No se pudieron guardar los cambios.')}
        </p>
      )}
      {darDeBaja.isError && (
        <p className="text-sm text-destructive">
          {mensajeDeError(darDeBaja.error, 'No se pudo dar de baja la consulta.')}
        </p>
      )}
    </form>
  );
}
