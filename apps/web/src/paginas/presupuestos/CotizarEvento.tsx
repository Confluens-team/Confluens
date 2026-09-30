import type { PresupuestoDetallado, SalonConDistribuciones, TipoJornada } from '@confluens/shared';
import { AlertTriangle, CalendarDays, Check, Clock, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSolicitarPresupuesto } from '@/hooks/use-presupuestos';
import { useSalones } from '@/hooks/use-salones';
import { useServicios } from '@/hooks/use-servicios';
import { usePerfilCliente } from '@/hooks/use-sesion';
import { ErrorApiCliente } from '@/lib/api';
import { agruparPorCategoria } from '@/lib/catalogo';
import { formatearPesos, hoyISO, nombreCompleto } from '@/lib/formato';
import { DIAS_VIGENCIA_PRESUPUESTO, PORCENTAJE_SENA, desglosarIva } from '@/lib/importes';
import { FOTOS, fotoDeSalon } from '@/lib/fotos';
import { cn } from '@/lib/utils';

export interface ResultadoCotizacion {
  presupuesto: PresupuestoDetallado;
  salon: SalonConDistribuciones;
  tipoJornada: TipoJornada;
  cliente: { nombre: string; telefono: string; correo: string };
}

function Paso({
  numero,
  titulo,
  bajada,
  children,
}: {
  numero: number;
  titulo: string;
  bajada: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bordo font-serif text-sm text-crema">
          {numero}
        </span>
        <div>
          <h2 className="text-xl font-semibold text-bordo">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{bajada}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function precioSalon(salon: SalonConDistribuciones, jornada: TipoJornada) {
  return Number(jornada === 'completa' ? salon.precioJornadaCompleta : salon.precioMediaJornada);
}

// Cotizador del cliente registrado: la vista con precios de la landing. Calcula el total
// estimado en vivo para que el cliente vea cómo cambia, pero el presupuesto que vale es el que
// devuelve POST /presupuestos (HU-09), que es donde viven las reglas de cálculo.
export function CotizarEvento({
  salonInicialId,
  onGenerado,
}: {
  salonInicialId?: number;
  onGenerado: (resultado: ResultadoCotizacion) => void;
}) {
  const perfil = usePerfilCliente(true);
  const salones = useSalones();
  const servicios = useServicios();
  const solicitar = useSolicitarPresupuesto();

  const [fecha, setFecha] = useState('');
  const [personas, setPersonas] = useState('');
  const [jornada, setJornada] = useState<TipoJornada>('completa');
  const [salonId, setSalonId] = useState<number | undefined>(salonInicialId);
  // null = "para todas las personas del evento": sigue a la cantidad total si el cliente la cambia.
  // Un número es una cantidad parcial elegida a mano (RN-04).
  const [elegidos, setElegidos] = useState<Map<number, number | null>>(new Map());
  const [categoria, setCategoria] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const cantidadPersonas = Number(personas) || 0;
  // El cliente solo ve los salones publicados (HU-08), igual que en la landing.
  const salonesVisibles = (salones.data ?? []).filter((s) => s.visibleEnLanding);
  const salonElegido = salonesVisibles.find((s) => s.id === salonId);
  const entran = salonesVisibles.filter((s) => s.capacidadMaxima >= cantidadPersonas);
  // Sugerencia: el salón más chico en el que entran todos.
  const recomendado =
    cantidadPersonas > 0
      ? [...entran].sort((a, b) => a.capacidadMaxima - b.capacidadMaxima)[0]
      : undefined;
  const masGrande = [...salonesVisibles].sort((a, b) => b.capacidadMaxima - a.capacidadMaxima)[0];

  const catalogo = servicios.data ?? [];
  const grupos = agruparPorCategoria(catalogo);
  const categoriaActiva = categoria ?? grupos[0]?.[0];

  function cantidadDe(servicioId: number, porPersona: boolean) {
    if (!porPersona) return 1;
    return elegidos.get(servicioId) ?? cantidadPersonas;
  }

  const lineas = [
    ...(salonElegido
      ? [
          {
            clave: 'salon',
            descripcion: `Salón ${salonElegido.nombre}`,
            detalle: jornada === 'completa' ? 'Jornada completa' : 'Media jornada',
            subtotal: precioSalon(salonElegido, jornada),
            entraEnTotal: true,
          },
        ]
      : []),
    ...catalogo
      .filter((s) => elegidos.has(s.id))
      .map((s) => {
        const cantidad = cantidadDe(s.id, s.porPersona);
        return {
          clave: `servicio-${s.id}`,
          descripcion: s.nombre,
          detalle: s.porPersona
            ? `${cantidad} × ${formatearPesos(s.precio)}`
            : `Precio fijo · ${formatearPesos(s.precio)}`,
          subtotal: Number(s.precio) * cantidad,
          entraEnTotal: !s.tercerizado,
        };
      }),
  ];
  const { subtotal, iva, total } = desglosarIva(
    lineas.filter((l) => l.entraEnTotal).reduce((suma, l) => suma + l.subtotal, 0),
  );

  function alternarServicio(servicioId: number) {
    setElegidos((anteriores) => {
      const siguientes = new Map(anteriores);
      if (siguientes.has(servicioId)) siguientes.delete(servicioId);
      else siguientes.set(servicioId, null);
      return siguientes;
    });
  }

  function cambiarCantidad(servicioId: number, valor: string) {
    setElegidos((anteriores) => {
      const siguientes = new Map(anteriores);
      const numero = Number(valor);
      siguientes.set(servicioId, valor === '' || numero === cantidadPersonas ? null : numero);
      return siguientes;
    });
  }

  function generar() {
    const nuevosErrores: Record<string, string> = {};
    if (!fecha) nuevosErrores['fecha'] = 'Elegí la fecha del evento';
    else if (fecha < hoyISO()) nuevosErrores['fecha'] = 'La fecha no puede ser anterior a hoy';
    if (cantidadPersonas < 1) nuevosErrores['personas'] = 'Ingresá la cantidad de personas';
    if (!salonElegido) nuevosErrores['salon'] = 'Elegí un salón';
    else if (salonElegido.capacidadMaxima < cantidadPersonas)
      nuevosErrores['salon'] =
        `El salón ${salonElegido.nombre} admite hasta ${salonElegido.capacidadMaxima} personas`;
    for (const [id, cantidad] of elegidos) {
      if (cantidad !== null && (cantidad < 1 || cantidad > cantidadPersonas)) {
        nuevosErrores['servicios'] =
          'La cantidad de cada servicio tiene que estar entre 1 y el total de personas';
        nuevosErrores[`servicio-${id}`] = 'Cantidad inválida';
      }
    }
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0 || !salonElegido || !perfil.data) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // La solicitud y el presupuesto guardan el nombre completo, como lo cargaba el formulario.
    const cliente = { ...perfil.data, nombre: nombreCompleto(perfil.data) };
    solicitar.mutate(
      {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        correo: cliente.correo,
        salonId: salonElegido.id,
        fecha,
        cantidadPersonas,
        tipoJornada: jornada,
        servicios: catalogo
          .filter((s) => elegidos.has(s.id))
          .map((s) => ({ servicioId: s.id, cantidad: cantidadDe(s.id, s.porPersona) })),
      },
      {
        onSuccess: (presupuesto) =>
          onGenerado({ presupuesto, salon: salonElegido, tipoJornada: jornada, cliente }),
      },
    );
  }

  const mesVigente = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  return (
    <main className="fondo-papel min-h-screen pb-24">
      <section className="relative isolate overflow-hidden">
        <img src={FOTOS.evento} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bordo-oscuro via-bordo-oscuro/85 to-bordo-oscuro/50" />
        <div className="mx-auto max-w-6xl px-4 py-14 text-crema sm:px-6">
          <p className="text-xs font-semibold tracking-[0.3em] text-dorado uppercase">
            Cotizador online
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">
            {perfil.data ? `Hola, ${perfil.data.nombre}` : 'Armá tu presupuesto'}
          </h1>
          <p className="mt-4 max-w-xl font-display text-xl text-crema/80 italic">
            Contanos cómo es tu evento y armamos el presupuesto estimado con los precios vigentes.
          </p>
        </div>
      </section>

      {perfil.isError && (
        <div className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Esta cuenta no es de un cliente. Cerrá sesión y creá una cuenta de cliente para cotizar.
          </p>
        </div>
      )}

      <div className="mx-auto mt-10 grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Paso numero={1} titulo="Tu evento" bajada="Fecha, invitados y duración.">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fecha" className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-dorado" /> Fecha del evento
                </Label>
                <Input
                  id="fecha"
                  type="date"
                  min={hoyISO()}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="h-11"
                />
                {errores['fecha'] && <p className="text-xs text-destructive">{errores['fecha']}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="personas" className="inline-flex items-center gap-1.5">
                  <Users className="size-4 text-dorado" /> Cantidad de personas
                </Label>
                <Input
                  id="personas"
                  type="number"
                  min={1}
                  placeholder="Ej: 50"
                  value={personas}
                  onChange={(e) => setPersonas(e.target.value)}
                  className="h-11"
                />
                {errores['personas'] && (
                  <p className="text-xs text-destructive">{errores['personas']}</p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { valor: 'media', titulo: 'Media jornada', detalle: 'Hasta 4 horas inclusive' },
                  { valor: 'completa', titulo: 'Jornada completa', detalle: 'Más de 4 horas' },
                ] as const
              ).map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => setJornada(opcion.valor)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors',
                    jornada === opcion.valor
                      ? 'border-bordo bg-bordo/5'
                      : 'border-border hover:border-dorado',
                  )}
                >
                  <Clock
                    className={cn(
                      'size-5',
                      jornada === opcion.valor ? 'text-bordo' : 'text-muted-foreground',
                    )}
                  />
                  <span>
                    <span className="block font-medium">{opcion.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{opcion.detalle}</span>
                  </span>
                </button>
              ))}
            </div>
          </Paso>

          <Paso
            numero={2}
            titulo="Elegí el salón"
            bajada="Precios por evento, sin IVA, según la jornada elegida."
          >
            {salones.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {cantidadPersonas > 0 && entran.length === 0 && masGrande && (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Ningún salón cubre {cantidadPersonas} personas. El de mayor capacidad es{' '}
                {masGrande.nombre}, hasta {masGrande.capacidadMaxima} personas.
              </p>
            )}
            {errores['salon'] && (
              <p className="mb-4 text-sm text-destructive">{errores['salon']}</p>
            )}
            <div className="grid gap-3">
              {salonesVisibles.map((salon) => {
                const noEntran = cantidadPersonas > salon.capacidadMaxima;
                const elegido = salon.id === salonId;
                return (
                  <button
                    key={salon.id}
                    type="button"
                    disabled={noEntran}
                    onClick={() => setSalonId(salon.id)}
                    className={cn(
                      'flex items-center gap-4 overflow-hidden rounded-xl border-2 p-2 pr-4 text-left transition-all',
                      elegido
                        ? 'border-bordo bg-bordo/5 shadow-md'
                        : 'border-border hover:border-dorado',
                      noEntran && 'cursor-not-allowed opacity-45 hover:border-border',
                    )}
                  >
                    <img
                      src={fotoDeSalon(salon)}
                      alt=""
                      className="size-20 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-serif text-lg font-semibold text-bordo">
                          {salon.nombre}
                        </span>
                        {recomendado?.id === salon.id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-dorado/20 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-bordo uppercase">
                            <Sparkles className="size-3" /> Recomendado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Hasta {salon.capacidadMaxima} personas · {salon.superficie} m² ·{' '}
                        {salon.distribuciones.map((d) => d.nombre).join(', ')}
                      </p>
                      {noEntran && (
                        <p className="text-xs text-destructive">
                          No entran {cantidadPersonas} personas
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-lg font-semibold">
                        {formatearPesos(precioSalon(salon, jornada))}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground uppercase">+ IVA</p>
                    </div>
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                        elegido ? 'border-bordo bg-bordo text-crema' : 'border-input',
                      )}
                    >
                      {elegido && <Check className="size-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Paso>

          <Paso
            numero={3}
            titulo="Sumá la gastronomía"
            bajada="Opcional. Podés contratar un servicio para menos personas que el total."
          >
            {servicios.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {errores['servicios'] && (
              <p className="mb-4 text-sm text-destructive">{errores['servicios']}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {grupos.map(([nombre, items]) => {
                const cuantos = items.filter((s) => elegidos.has(s.id)).length;
                return (
                  <button
                    key={nombre}
                    type="button"
                    onClick={() => setCategoria(nombre)}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                      nombre === categoriaActiva
                        ? 'border-bordo bg-bordo text-crema'
                        : 'border-border hover:border-dorado',
                    )}
                  >
                    {nombre}
                    {cuantos > 0 && (
                      <span className="ml-1.5 rounded-full bg-dorado px-1.5 text-bordo-oscuro">
                        {cuantos}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <ul className="mt-5 divide-y divide-border">
              {(grupos.find(([nombre]) => nombre === categoriaActiva)?.[1] ?? []).map(
                (servicio) => {
                  const marcado = elegidos.has(servicio.id);
                  const cantidadManual = elegidos.get(servicio.id);
                  return (
                    <li key={servicio.id} className="py-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`servicio-${servicio.id}`}
                          checked={marcado}
                          onCheckedChange={() => alternarServicio(servicio.id)}
                          className="mt-1"
                        />
                        <label
                          htmlFor={`servicio-${servicio.id}`}
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="block font-medium">{servicio.nombre}</span>
                          <span className="line-clamp-2 block text-xs text-muted-foreground">
                            {servicio.descripcion}
                          </span>
                        </label>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold">{formatearPesos(servicio.precio)}</p>
                          <p className="text-[0.65rem] text-muted-foreground">
                            {servicio.porPersona ? 'por persona' : 'precio fijo'}
                          </p>
                        </div>
                      </div>
                      {marcado && servicio.porPersona && (
                        <div className="mt-3 ml-7 flex items-center gap-2 text-xs text-muted-foreground">
                          Para
                          <Input
                            type="number"
                            min={1}
                            max={cantidadPersonas || undefined}
                            value={cantidadManual ?? (cantidadPersonas || '')}
                            onChange={(e) => cambiarCantidad(servicio.id, e.target.value)}
                            className={cn(
                              'h-8 w-20',
                              errores[`servicio-${servicio.id}`] && 'border-destructive',
                            )}
                          />
                          personas
                          {cantidadPersonas > 0 && (
                            <span className="ml-auto font-medium text-foreground">
                              {formatearPesos(
                                Number(servicio.precio) *
                                  cantidadDe(servicio.id, servicio.porPersona),
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                },
              )}
            </ul>
          </Paso>
        </div>

        {/* Resumen en vivo */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border">
            <div className="bg-bordo px-6 py-5 text-crema">
              <p className="text-xs font-semibold tracking-[0.25em] text-dorado uppercase">
                Tu presupuesto
              </p>
              <p className="mt-1 text-sm text-crema/75">
                {fecha ? fecha.split('-').reverse().join('/') : 'Sin fecha'} ·{' '}
                {cantidadPersonas > 0 ? `${cantidadPersonas} personas` : 'sin personas'}
              </p>
            </div>
            <div className="p-6">
              {lineas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Elegí un salón y los servicios para ver el total estimado.
                </p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {lineas.map((linea) => (
                    <li key={linea.clave} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{linea.descripcion}</span>
                        <span className="text-xs text-muted-foreground">{linea.detalle}</span>
                      </span>
                      <span className="shrink-0 font-medium">{formatearPesos(linea.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* RN-05: subtotal sin IVA, IVA 21% y total, recalculados con cada selección. */}
              <dl className="mt-6 space-y-1.5 border-t border-dashed border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal sin IVA</dt>
                  <dd className="font-medium tabular-nums">{formatearPesos(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">IVA 21%</dt>
                  <dd className="font-medium tabular-nums">{formatearPesos(iva)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-2">
                  <dt className="font-medium">Total estimado</dt>
                  <dd className="font-serif text-3xl font-semibold text-bordo tabular-nums">
                    {formatearPesos(total)}
                  </dd>
                </div>
              </dl>
              <p className="mt-1 text-right text-xs text-muted-foreground">
                Precios de {mesVigente}
              </p>
              {total > 0 && (
                <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Validez de {DIAS_VIGENCIA_PRESUPUESTO} días. Para reservar el salón se abona una
                  seña del {PORCENTAJE_SENA}% del total dentro de ese plazo.
                </p>
              )}

              {solicitar.isError && (
                <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {solicitar.error instanceof ErrorApiCliente
                    ? solicitar.error.message
                    : 'No se pudo generar el presupuesto.'}
                </p>
              )}

              <Button
                size="lg"
                className="mt-6 h-12 w-full text-sm"
                disabled={solicitar.isPending || !perfil.data}
                onClick={generar}
              >
                {solicitar.isPending ? 'Generando…' : 'Generar presupuesto'}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
