import type {
  PresupuestoDetallado,
  SalonConDistribuciones,
  TipoEvento,
  TipoEventoSocial,
  TipoJornada,
} from '@confluens/shared';
import {
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  ETIQUETAS_TIPO_EVENTO_SOCIAL,
  etiquetaTipoEvento,
  PORCENTAJE_SENA,
} from '@confluens/shared';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  PartyPopper,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEnviarConsultaSocial, useSolicitarPresupuesto } from '@/hooks/use-presupuestos';
import { useSalones } from '@/hooks/use-salones';
import { useServicios } from '@/hooks/use-servicios';
import { usePerfilCliente } from '@/hooks/use-sesion';
import { ErrorApiCliente } from '@/lib/api';
import { agruparPorCategoria } from '@/lib/catalogo';
import { formatearPesos, hoyISO, nombreCompleto } from '@/lib/formato';
import { FOTOS, fotoDeSalon } from '@/lib/fotos';
import { cn } from '@/lib/utils';

interface ContactoCliente {
  nombre: string;
  telefono: string;
  correo: string;
}

// Evento corporativo: el presupuesto estimado que devolvió la API.
export interface PresupuestoGenerado {
  presupuesto: PresupuestoDetallado;
  salon: SalonConDistribuciones;
  tipoJornada: TipoJornada;
  cliente: ContactoCliente;
}

// Evento social (ADR 0008): solo la consulta; el presupuesto lo arma el Responsable de Eventos.
export interface ConsultaSocialEnviada {
  consulta: {
    fecha: string;
    cantidadPersonas: number;
    tipoJornada: TipoJornada;
    horaInicioEstimada?: string;
    tipoSocial: TipoEventoSocial;
    tipoSocialDetalle?: string;
  };
  cliente: ContactoCliente;
}

export type ResultadoCotizacion =
  ({ tipo: 'Corporativo' } & PresupuestoGenerado) | ({ tipo: 'Social' } & ConsultaSocialEnviada);

// Los dos botones con foto del paso 2. Las fotos son de public/fotos y se pueden cambiar.
const OPCIONES_TIPO: {
  valor: TipoEvento;
  titulo: string;
  detalle: string;
  foto: string;
  Icono: typeof Briefcase;
}[] = [
  {
    valor: 'Corporativo',
    titulo: 'Evento corporativo',
    detalle: 'Capacitaciones, reuniones, congresos. Armá tu presupuesto al instante.',
    foto: FOTOS.auditorio,
    Icono: Briefcase,
  },
  {
    valor: 'Social',
    titulo: 'Evento social',
    detalle: 'Cumpleaños, casamientos, fiestas de 15 y más. Lo armamos con vos.',
    foto: FOTOS.evento,
    Icono: PartyPopper,
  },
];

const TIPOS_SOCIALES = Object.entries(ETIQUETAS_TIPO_EVENTO_SOCIAL) as [TipoEventoSocial, string][];

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

// Cotizador del cliente registrado: la vista con precios de la landing. Primero el evento (fecha,
// personas, jornada, hora estimada) y después el tipo (ADR 0008):
// - Corporativo: elige salón y servicios y ve el total estimado en vivo; el presupuesto que vale es
//   el que devuelve POST /presupuestos (HU-09), que es donde viven las reglas de cálculo.
// - Social: elige qué evento es y manda la consulta, sin salón, servicios ni precios. El
//   presupuesto lo arma el Responsable de Eventos.
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
  const enviarSocial = useEnviarConsultaSocial();

  const [fecha, setFecha] = useState('');
  const [personas, setPersonas] = useState('');
  const [jornada, setJornada] = useState<TipoJornada>('completa');
  const [hora, setHora] = useState('');
  // Si llega desde un salón de la landing (?salon=), es un evento corporativo.
  const [tipo, setTipo] = useState<TipoEvento | undefined>(
    salonInicialId ? 'Corporativo' : undefined,
  );
  const [tipoSocial, setTipoSocial] = useState<TipoEventoSocial | undefined>();
  const [detalleOtro, setDetalleOtro] = useState('');
  const [salonId, setSalonId] = useState<number | undefined>(salonInicialId);
  // null = "para todas las personas del evento": sigue a la cantidad total si el cliente la cambia.
  // Un número es una cantidad parcial elegida a mano (RN-04).
  const [elegidos, setElegidos] = useState<Map<number, number | null>>(new Map());
  // Hora "HH:mm" a la que el cliente espera cada servicio dentro del evento (un coffee a las
  // 10:30). Va aparte de `elegidos` porque es opcional: la mayoría de los servicios no la lleva.
  const [horas, setHoras] = useState<Map<number, string>>(new Map());
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
            aCotizar: false,
          },
        ]
      : []),
    ...catalogo
      .filter((s) => elegidos.has(s.id))
      .map((s) => {
        const cantidad = cantidadDe(s.id, s.porPersona);
        const aLas = horas.get(s.id) ? ` · a las ${horas.get(s.id)}` : '';
        // HU-11: un tercerizado sin precio fijo entra "a cotizar": sin importe y sin sumar.
        if (s.precio === null) {
          return {
            clave: `servicio-${s.id}`,
            descripcion: s.nombre,
            detalle: `A cotizar: el precio lo confirma el equipo${aLas}`,
            subtotal: 0,
            aCotizar: true,
          };
        }
        return {
          clave: `servicio-${s.id}`,
          descripcion: s.nombre,
          detalle:
            (s.porPersona
              ? `${cantidad} × ${formatearPesos(s.precio)}`
              : `Precio fijo · ${formatearPesos(s.precio)}`) + aLas,
          subtotal: Number(s.precio) * cantidad,
          aCotizar: false,
        };
      }),
  ];
  const { subtotal, iva, total } = desglosarIva(
    // Los tercerizados suman como cualquier servicio (dominio.md, 24/09/2026).
    lineas.reduce((suma, l) => suma + l.subtotal, 0),
  );

  function alternarServicio(servicioId: number) {
    setElegidos((anteriores) => {
      const siguientes = new Map(anteriores);
      if (siguientes.has(servicioId)) siguientes.delete(servicioId);
      else siguientes.set(servicioId, null);
      return siguientes;
    });
    // Un servicio que se destilda se lleva su hora: si vuelve a elegirse, arranca sin hora.
    setHoras((anteriores) => {
      const siguientes = new Map(anteriores);
      siguientes.delete(servicioId);
      return siguientes;
    });
  }

  function cambiarHora(servicioId: number, valor: string) {
    setHoras((anteriores) => {
      const siguientes = new Map(anteriores);
      if (valor) siguientes.set(servicioId, valor);
      else siguientes.delete(servicioId);
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

  function validarEvento(nuevosErrores: Record<string, string>) {
    if (!fecha) nuevosErrores['fecha'] = 'Elegí la fecha del evento';
    else if (fecha < hoyISO()) nuevosErrores['fecha'] = 'La fecha no puede ser anterior a hoy';
    if (cantidadPersonas < 1) nuevosErrores['personas'] = 'Ingresá la cantidad de personas';
    if (!tipo) nuevosErrores['tipo'] = 'Elegí si es un evento corporativo o social';
  }

  function mostrarErrores(nuevosErrores: Record<string, string>) {
    setErrores(nuevosErrores);
    const hayErrores = Object.keys(nuevosErrores).length > 0;
    if (hayErrores) window.scrollTo({ top: 0, behavior: 'smooth' });
    return hayErrores;
  }

  // ADR 0008: la consulta social no lleva salón, servicios ni presupuesto.
  function enviarConsultaSocial() {
    const nuevosErrores: Record<string, string> = {};
    validarEvento(nuevosErrores);
    if (!tipoSocial) nuevosErrores['tipoSocial'] = 'Elegí qué tipo de evento es';
    else if (tipoSocial === 'Otro' && !detalleOtro.trim())
      nuevosErrores['detalleOtro'] = 'Contanos qué evento es';
    if (mostrarErrores(nuevosErrores) || !tipoSocial || !perfil.data) return;

    const cliente = { ...perfil.data, nombre: nombreCompleto(perfil.data) };
    const consulta = {
      fecha,
      cantidadPersonas,
      tipoJornada: jornada,
      horaInicioEstimada: hora || undefined,
      tipoSocial,
      tipoSocialDetalle: tipoSocial === 'Otro' ? detalleOtro.trim() : undefined,
    };
    enviarSocial.mutate(
      {
        contacto: { nombre: cliente.nombre, telefono: cliente.telefono, correo: cliente.correo },
        consulta,
      },
      { onSuccess: () => onGenerado({ tipo: 'Social', consulta, cliente }) },
    );
  }

  function generar() {
    const nuevosErrores: Record<string, string> = {};
    validarEvento(nuevosErrores);
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
    if (mostrarErrores(nuevosErrores) || !salonElegido || !perfil.data) return;

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
        horaInicioEstimada: hora || undefined,
        servicios: catalogo
          .filter((s) => elegidos.has(s.id))
          .map((s) => ({
            servicioId: s.id,
            cantidad: cantidadDe(s.id, s.porPersona),
            horaEstimada: horas.get(s.id) || undefined,
          })),
      },
      {
        onSuccess: (presupuesto) =>
          onGenerado({
            tipo: 'Corporativo',
            presupuesto,
            salon: salonElegido,
            tipoJornada: jornada,
            cliente,
          }),
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
          <p className="text-xs font-semibold tracking-[0.3em] text-dorado-claro uppercase">
            Cotizador online
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">
            {perfil.data ? `Hola, ${perfil.data.nombre}` : 'Armá tu presupuesto'}
          </h1>
          <p className="mt-4 max-w-xl font-display text-xl text-crema/80 italic">
            Contanos cómo es tu evento: si es corporativo armás el presupuesto al instante; si es
            social, lo armamos con vos.
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

            <div className="mt-5 flex flex-col gap-1.5 sm:max-w-[calc(50%-0.625rem)]">
              <Label htmlFor="hora" className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-dorado" /> Hora de inicio estimada
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="h-11"
              />
            </div>
          </Paso>

          <Paso
            numero={2}
            titulo="¿Qué tipo de evento es?"
            bajada="Los eventos sociales son muy personalizables: los armamos juntos."
          >
            {errores['tipo'] && <p className="mb-4 text-sm text-destructive">{errores['tipo']}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {OPCIONES_TIPO.map(({ valor, titulo, detalle, foto, Icono }) => {
                const elegido = tipo === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => setTipo(valor)}
                    className={cn(
                      'group overflow-hidden rounded-xl border-2 text-left transition-all',
                      elegido
                        ? 'border-bordo bg-bordo/5 shadow-md'
                        : 'border-border hover:border-dorado',
                    )}
                  >
                    <div className="relative h-36 overflow-hidden">
                      <img
                        src={foto}
                        alt=""
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* AC2 de la auditoría de accesibilidad: mismo criterio que las tarjetas
                          de salones de la landing. */}
                      <div className="absolute inset-0 bg-gradient-to-t from-bordo-oscuro/95 via-bordo-oscuro/30 to-transparent" />
                      <span className="absolute bottom-3 left-4 inline-flex items-center gap-2 font-serif text-lg font-semibold text-crema">
                        <Icono className="size-5 text-dorado" /> {titulo}
                      </span>
                      {elegido && (
                        <span className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-bordo text-crema">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="px-4 py-3 text-xs text-muted-foreground">{detalle}</p>
                  </button>
                );
              })}
            </div>

            {tipo === 'Social' && (
              <div className="mt-6 border-t border-dashed border-border pt-5">
                <p className="text-sm font-medium">¿Qué celebrás?</p>
                {errores['tipoSocial'] && (
                  <p className="mt-1 text-xs text-destructive">{errores['tipoSocial']}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {TIPOS_SOCIALES.map(([valor, etiqueta]) => (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={tipoSocial === valor}
                      onClick={() => setTipoSocial(valor)}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                        tipoSocial === valor
                          ? 'border-bordo bg-bordo text-crema'
                          : 'border-border hover:border-dorado',
                      )}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
                {tipoSocial === 'Otro' && (
                  <div className="mt-4 flex flex-col gap-1.5">
                    <Label htmlFor="detalle-otro">Contanos qué evento es</Label>
                    <Input
                      id="detalle-otro"
                      maxLength={120}
                      placeholder="Ej: despedida de soltera, aniversario, egresados…"
                      value={detalleOtro}
                      onChange={(e) => setDetalleOtro(e.target.value)}
                      className="h-11"
                    />
                    {errores['detalleOtro'] && (
                      <p className="text-xs text-destructive">{errores['detalleOtro']}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Paso>

          {tipo === 'Corporativo' && (
            <Paso
              numero={3}
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
                        src={fotoDeSalon(salon, 200)}
                        alt=""
                        loading="lazy"
                        decoding="async"
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
          )}

          {tipo === 'Corporativo' && (
            <Paso
              numero={4}
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
                            <p className="font-semibold">
                              {servicio.precio === null
                                ? 'A cotizar'
                                : formatearPesos(servicio.precio)}
                            </p>
                            <p className="text-[0.65rem] text-muted-foreground">
                              {servicio.porPersona ? 'por persona' : 'precio fijo'}
                            </p>
                          </div>
                        </div>
                        {marcado && (
                          <div className="mt-3 ml-7 flex flex-wrap items-center gap-x-2 gap-y-3 text-xs text-muted-foreground">
                            {servicio.porPersona && (
                              <>
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
                              </>
                            )}
                            {/* Opcional: a qué hora del evento se espera el servicio. El horario
                                real lo carga el equipo al agendar, así que acá no hay contra qué
                                validarla: es la preferencia del cliente. */}
                            <label
                              htmlFor={`hora-${servicio.id}`}
                              className={servicio.porPersona ? 'ml-2' : undefined}
                            >
                              A las
                            </label>
                            <Input
                              id={`hora-${servicio.id}`}
                              type="time"
                              value={horas.get(servicio.id) ?? ''}
                              onChange={(e) => cambiarHora(servicio.id, e.target.value)}
                              className="h-8 w-28"
                            />
                            <span>(opcional)</span>
                            {cantidadPersonas > 0 && servicio.precio !== null && (
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
          )}
        </div>

        {/* Resumen en vivo */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {tipo === 'Social' ? (
            <ResumenConsultaSocial
              fecha={fecha}
              cantidadPersonas={cantidadPersonas}
              jornada={jornada}
              hora={hora}
              tipoSocial={tipoSocial}
              detalleOtro={detalleOtro}
              error={
                enviarSocial.isError
                  ? enviarSocial.error instanceof ErrorApiCliente
                    ? enviarSocial.error.message
                    : 'No se pudo enviar la consulta.'
                  : undefined
              }
              enviando={enviarSocial.isPending}
              deshabilitado={enviarSocial.isPending || !perfil.data}
              onEnviar={enviarConsultaSocial}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border">
              <div className="bg-bordo px-6 py-5 text-crema">
                <p className="text-xs font-semibold tracking-[0.25em] text-dorado-claro uppercase">
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
                    {tipo
                      ? 'Elegí un salón y los servicios para ver el total estimado.'
                      : 'Contanos qué tipo de evento es para seguir.'}
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {lineas.map((linea) => (
                      <li key={linea.clave} className="flex justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{linea.descripcion}</span>
                          <span className="text-xs text-muted-foreground">{linea.detalle}</span>
                        </span>
                        <span className="shrink-0 font-medium">
                          {linea.aCotizar ? 'A cotizar' : formatearPesos(linea.subtotal)}
                        </span>
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
                    seña del {PORCENTAJE_SENA}% dentro de ese plazo, calculada sobre el total con
                    IVA.
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
                  hidden={!tipo}
                >
                  {solicitar.isPending ? 'Generando…' : 'Generar presupuesto'}
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

// Resumen lateral de la consulta social (ADR 0008): lo que el cliente contó, sin precios.
function ResumenConsultaSocial({
  fecha,
  cantidadPersonas,
  jornada,
  hora,
  tipoSocial,
  detalleOtro,
  error,
  enviando,
  deshabilitado,
  onEnviar,
}: {
  fecha: string;
  cantidadPersonas: number;
  jornada: TipoJornada;
  hora: string;
  tipoSocial: TipoEventoSocial | undefined;
  detalleOtro: string;
  error: string | undefined;
  enviando: boolean;
  deshabilitado: boolean;
  onEnviar: () => void;
}) {
  const filas = [
    [
      'Evento',
      tipoSocial
        ? etiquetaTipoEvento({ tipo: 'Social', tipoSocial, tipoSocialDetalle: detalleOtro.trim() })
        : 'Elegí qué celebrás',
    ],
    ['Fecha', fecha ? fecha.split('-').reverse().join('/') : 'Sin fecha'],
    ['Invitados', cantidadPersonas > 0 ? `${cantidadPersonas} personas` : 'Sin definir'],
    ['Duración', jornada === 'completa' ? 'Jornada completa' : 'Media jornada'],
    ['Inicio estimado', hora ? `${hora} h` : 'A definir'],
  ];
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-lg ring-1 ring-border">
      <div className="bg-bordo px-6 py-5 text-crema">
        <p className="text-xs font-semibold tracking-[0.25em] text-dorado-claro uppercase">
          Tu consulta
        </p>
        <p className="mt-1 text-sm text-crema/75">Evento social</p>
      </div>
      <div className="p-6">
        <dl className="space-y-3 text-sm">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{etiqueta}</dt>
              <dd className="text-right font-medium">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Cada evento social es único: con tu consulta, un responsable de eventos se comunica con
          vos para elegir juntos el salón, la gastronomía y armar el presupuesto.
        </p>
        {error && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          size="lg"
          className="mt-6 h-12 w-full text-sm"
          disabled={deshabilitado}
          onClick={onEnviar}
        >
          {enviando ? 'Enviando…' : 'Enviar consulta'}
        </Button>
      </div>
    </div>
  );
}
