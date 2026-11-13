import type {
  ModalidadServicio,
  PresupuestoDetallado,
  SalonConDistribuciones,
  Servicio,
  TipoEvento,
  TipoEventoSocial,
  TipoJornada,
} from '@confluens/shared';
import {
  aplicarModalidad,
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  ETIQUETAS_TIPO_EVENTO_SOCIAL,
  etiquetaTipoEvento,
  fechasDeLaFranja,
  hoyEnZonaEventos,
  MAXIMO_PERSONAS_EVENTO,
  mesesHastaEvento,
  PORCENTAJE_SENA,
  proyectarPrecio,
} from '@confluens/shared';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  Copy,
  PartyPopper,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { InputEntero } from '@/components/InputEntero';
import { SelectorHora, SelectorRangoFechas } from '@/components/SelectorFechaHora';
import { SelectorModalidad } from '@/components/SelectorModalidad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfiguracionPrecios } from '@/hooks/use-configuracion-precios';
import { useEnviarConsultaSocial, useSolicitarPresupuesto } from '@/hooks/use-presupuestos';
import { useSalones } from '@/hooks/use-salones';
import { useServicios } from '@/hooks/use-servicios';
import { usePerfilCliente } from '@/hooks/use-sesion';
import { ErrorApiCliente } from '@/lib/api';
import { agruparPorCategoria } from '@/lib/catalogo';
import { nombreDeJornada, resumenDeJornada, textoDePersonas } from '@/lib/dias-del-evento';
import { formatearPesos, hoyISO, nombreCompleto, textoModalidad } from '@/lib/formato';
import { FOTOS, fotoDeSalon, fotoOptimizada } from '@/lib/fotos';
import { jornadaDeHoras, textoHorarioEstimado } from '@/lib/jornada';
import { textoDeDias } from '@/lib/rango-de-fechas';
import { cn } from '@/lib/utils';

interface ContactoCliente {
  nombre: string;
  // El apellido del perfil, aparte: nombra el PDF del presupuesto (nombre-pdf.ts).
  apellido?: string | null;
  telefono: string;
  correo: string;
}

// Evento corporativo: el presupuesto estimado que devolvió la API.
export interface PresupuestoGenerado {
  presupuesto: PresupuestoDetallado;
  salones: SalonConDistribuciones[];
  tipoJornada: TipoJornada;
  cliente: ContactoCliente;
  // HU-50: con más de un día, lo que se cotizó en cada uno (las líneas del presupuesto se reparten
  // por día en el mismo orden). Un evento de un solo día no lo trae.
  dias?: {
    fecha: string;
    cantidadPersonas: number;
    tipoJornada: TipoJornada;
    salones: SalonConDistribuciones[];
  }[];
}

// Evento social (ADR 0008): solo la consulta; el presupuesto lo arma el Responsable de Eventos.
export interface ConsultaSocialEnviada {
  consulta: {
    fecha: string;
    // HU-50: el último día, si el evento dura varios.
    fechaFin?: string;
    cantidadPersonas: number;
    tipoJornada: TipoJornada;
    horaInicioEstimada?: string;
    horaFinEstimada?: string;
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

// Las dos duraciones que el cliente puede elegir en un evento corporativo. No llevan precio propio:
// el que cambia es el de cada salón y el del presupuesto, y mostrarlo también acá parecía un
// importe más para sumar.
const OPCIONES_JORNADA = [
  { valor: 'media', titulo: 'Media jornada', detalle: 'Hasta 4 horas inclusive' },
  { valor: 'completa', titulo: 'Jornada completa', detalle: 'Más de 4 horas' },
] as const;

function OpcionesJornada({
  jornada,
  onChange,
}: {
  jornada: TipoJornada;
  onChange: (jornada: TipoJornada) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPCIONES_JORNADA.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          aria-pressed={jornada === opcion.valor}
          onClick={() => onChange(opcion.valor)}
          className={cn(
            'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors',
            jornada === opcion.valor
              ? 'border-bordo bg-bordo/5'
              : 'border-border hover:border-dorado',
          )}
        >
          <Clock
            className={cn(
              'size-5 shrink-0',
              jornada === opcion.valor ? 'text-bordo' : 'text-muted-foreground',
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{opcion.titulo}</span>
            <span className="block text-xs text-muted-foreground">{opcion.detalle}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function CampoHora({
  id,
  etiqueta,
  value,
  onChange,
  horaSugerida,
  error,
  className,
}: {
  id: string;
  etiqueta: string;
  value: string;
  onChange: (hora: string) => void;
  horaSugerida?: string;
  error?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="inline-flex items-center gap-1.5">
        <Clock className="size-4 text-dorado" /> {etiqueta}
        <span className="font-normal text-muted-foreground">(opcional)</span>
      </Label>
      <SelectorHora
        id={id}
        value={value}
        onChange={onChange}
        horaSugerida={horaSugerida}
        opcional
        placeholder="Elegí la hora"
        className="h-11"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Cantidad de personas de un servicio. Mientras se edita el campo guarda su propio texto, así se
// puede borrar todo y tipear otro número; el valor que cuenta no cambia hasta que hay un número. Al
// salir del campo, si quedó vacío, vuelve a mostrar el valor que estaba.
function CantidadDeServicio({
  valor,
  max,
  onCambio,
  ...props
}: {
  valor: number;
  max?: number;
  onCambio: (valor: string) => void;
  'aria-label': string;
  className?: string;
}) {
  const [borrador, setBorrador] = useState<string | null>(null);
  return (
    <InputEntero
      {...props}
      max={max}
      value={borrador ?? (valor || '')}
      onChangeValor={(texto) => {
        setBorrador(texto);
        if (texto !== '') onCambio(texto);
      }}
      onBlur={() => setBorrador(null)}
    />
  );
}

// HU-50: lo que cambia de un día a otro en un evento corporativo de varios días. Cada día tiene sus
// personas, su jornada, sus salones y sus servicios; lo del evento entero (tipo, hora estimada) no.
interface EstadoDeDia {
  personas: string;
  jornada: TipoJornada;
  // El orden es el de la elección: es el orden de las líneas del presupuesto (ADR 0011).
  salonIds: number[];
  // null = "para todas las personas del día": sigue a la cantidad total si el cliente la cambia.
  // Un número es una cantidad parcial elegida a mano (RN-04).
  elegidos: Map<number, number | null>;
  // Hora "HH:mm" a la que el cliente espera cada servicio dentro del evento (un coffee a las 10:30).
  horas: Map<number, string>;
  // RN-11: la modalidad de cada servicio que la admite (hoy, los coffee breaks). Sin entrada, Normal.
  modalidades: Map<number, ModalidadServicio>;
}

const diaVacio = (salonIds: number[] = []): EstadoDeDia => ({
  personas: '',
  jornada: 'completa',
  salonIds,
  elegidos: new Map(),
  horas: new Map(),
  modalidades: new Map(),
});

// Copiar un día a otro: lo cargado se copia, no se comparte (los Map se duplican).
const copiaDeDia = (dia: EstadoDeDia): EstadoDeDia => ({
  ...dia,
  salonIds: [...dia.salonIds],
  elegidos: new Map(dia.elegidos),
  horas: new Map(dia.horas),
  modalidades: new Map(dia.modalidades),
});

const formateadorDiaSemana = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  timeZone: 'UTC',
});
// «lun 16/11»: el día de la semana y la fecha, para las pestañas y los títulos de cada día.
const nombreDeDia = (fecha: string) => {
  const [, mes = '', dia = ''] = fecha.split('-');
  const semana = formateadorDiaSemana.format(new Date(`${fecha}T00:00:00Z`)).replace('.', '');
  return `${semana} ${dia}/${mes}`;
};

function precioSalon(salon: SalonConDistribuciones, jornada: TipoJornada) {
  return jornada === 'completa' ? salon.precioJornadaCompleta : salon.precioMediaJornada;
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
  const configuracion = useConfiguracionPrecios();
  const solicitar = useSolicitarPresupuesto();
  const enviarSocial = useEnviarConsultaSocial();

  // HU-50: la franja del evento. Sin segundo clic dura un solo día (`fechaFin` igual a `fecha`).
  const [fecha, setFecha] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  // Lo de cada día, por posición en la franja: al correr o achicar la franja se conserva lo cargado.
  const [dias, setDias] = useState<EstadoDeDia[]>(() => [
    diaVacio(salonInicialId ? [salonInicialId] : []),
  ]);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [hora, setHora] = useState('');
  // Solo en un evento social, que no elige salón ni duración: cuenta cuándo empieza y termina.
  const [horaFin, setHoraFin] = useState('');
  // Si llega desde un salón de la landing (?salon=), es un evento corporativo.
  const [tipo, setTipo] = useState<TipoEvento | undefined>(
    salonInicialId ? 'Corporativo' : undefined,
  );
  const [tipoSocial, setTipoSocial] = useState<TipoEventoSocial | undefined>();
  const [detalleOtro, setDetalleOtro] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [erroresGlobales, setErrores] = useState<Record<string, string>>({});
  // Los errores de cada día, por posición: al validar se avisa de todos y se salta al primero.
  const [erroresDeDias, setErroresDeDias] = useState<Record<number, Record<string, string>>>({});

  // Las fechas de la franja y el día que se está cargando. Un evento social no tiene pestañas: es
  // una sola consulta para todos los días (el detalle lo arma el Responsable de Eventos).
  const fechas = fecha ? fechasDeLaFranja(fecha, fechaFin || fecha) : [];
  const cantidadDeDias = Math.max(fechas.length, 1);
  const variosDias = tipo === 'Corporativo' && cantidadDeDias > 1;
  const activo = tipo === 'Social' ? 0 : Math.min(indiceActivo, cantidadDeDias - 1);
  const diaActual = dias[activo] ?? diaVacio();
  const { personas, jornada, salonIds, elegidos, horas, modalidades } = diaActual;
  // Lo que se muestra: los errores del evento y los del día que se está cargando.
  const errores = { ...erroresGlobales, ...erroresDeDias[activo] };

  // Cada setter escribe en el día activo y acepta un valor o una función del valor anterior, como un
  // useState: así el resto de la pantalla sigue hablando de «las personas», «los salones»...
  const delActivo =
    <K extends keyof EstadoDeDia>(clave: K) =>
    (valor: EstadoDeDia[K] | ((anterior: EstadoDeDia[K]) => EstadoDeDia[K])) =>
      setDias((anteriores) => {
        const siguientes = [...anteriores];
        while (siguientes.length <= activo) siguientes.push(diaVacio());
        const dia = siguientes[activo]!;
        const nuevo =
          typeof valor === 'function'
            ? (valor as (anterior: EstadoDeDia[K]) => EstadoDeDia[K])(dia[clave])
            : valor;
        siguientes[activo] = { ...dia, [clave]: nuevo };
        return siguientes;
      });
  const setPersonas = delActivo('personas');
  const setJornada = delActivo('jornada');
  const setSalonIds = delActivo('salonIds');
  const setElegidos = delActivo('elegidos');
  const setHoras = delActivo('horas');
  const setModalidades = delActivo('modalidades');

  function elegirFranja(inicio: string, fin: string) {
    setFecha(inicio);
    setFechaFin(fin);
    setIndiceActivo(0);
  }

  // «Copiar el día anterior»: le pasa al día que se está mirando los salones, la jornada, las
  // personas y los servicios del anterior (el horario estimado es uno para todo el evento).
  function copiarDiaAnterior() {
    if (activo === 0) return;
    setDias((anteriores) => {
      const siguientes = [...anteriores];
      while (siguientes.length <= activo) siguientes.push(diaVacio());
      siguientes[activo] = copiaDeDia(siguientes[activo - 1]!);
      return siguientes;
    });
    setErroresDeDias((anteriores) => ({ ...anteriores, [activo]: {} }));
  }

  const cantidadPersonas = Number(personas) || 0;
  // El cliente solo ve los salones publicados (HU-08), igual que en la landing.
  const salonesVisibles = (salones.data ?? []).filter((s) => s.visibleEnLanding);
  const salonesElegidos = salonIds
    .map((id) => salonesVisibles.find((s) => s.id === id))
    .filter((s): s is SalonConDistribuciones => s !== undefined);
  // Capacidad sumada de lo elegido: la gente se reparte entre los salones (ADR 0011).
  const capacidadElegida = salonesElegidos.reduce((suma, s) => suma + s.capacidadMaxima, 0);

  function alternarSalon(id: number) {
    setSalonIds((anteriores) =>
      anteriores.includes(id) ? anteriores.filter((otro) => otro !== id) : [...anteriores, id],
    );
  }
  const entran = salonesVisibles.filter((s) => s.capacidadMaxima >= cantidadPersonas);
  // Sugerencia: el salón más chico en el que entran todos.
  const recomendado =
    cantidadPersonas > 0
      ? [...entran].sort((a, b) => a.capacidadMaxima - b.capacidadMaxima)[0]
      : undefined;
  const masGrande = [...salonesVisibles].sort((a, b) => b.capacidadMaxima - a.capacidadMaxima)[0];

  // RN-13: los precios se proyectan a la fecha del evento con el incremento mensual, con la misma
  // cuenta que hace la API al generar el presupuesto. Con varios días la referencia es el ÚLTIMO día
  // para todos (decisión del PO, 12/11/2026). Sin fecha todavía, se muestran los de hoy.
  const fechaDeReferencia = fechas[fechas.length - 1] ?? fecha;
  const meses = fechaDeReferencia ? mesesHastaEvento(hoyEnZonaEventos(), fechaDeReferencia) : 0;
  const porcentajeMensual = configuracion.data?.porcentajeMensual ?? '0';
  const proyectar = (precio: string) => proyectarPrecio(precio, porcentajeMensual, meses);
  const precioDeSalonEn = (salon: SalonConDistribuciones, jornadaDelDia: TipoJornada) =>
    Number(proyectar(precioSalon(salon, jornadaDelDia)));
  const precioDeSalon = (salon: SalonConDistribuciones) => precioDeSalonEn(salon, jornada);
  // El unitario de un servicio: el vigente (sin proyectar si es tercerizado) con el recargo de su
  // modalidad (RN-11). null = a cotizar.
  const modalidadDe = (servicioId: number) => modalidades.get(servicioId) ?? 'Normal';
  const precioDeServicioCon = (servicio: Servicio, modalidad: ModalidadServicio): number | null => {
    if (servicio.precio === null) return null;
    const base = servicio.tercerizado ? servicio.precio : proyectar(servicio.precio);
    return Number(aplicarModalidad(base, modalidad));
  };
  const precioDeServicio = (servicio: Servicio): number | null =>
    precioDeServicioCon(servicio, modalidadDe(servicio.id));

  const catalogo = servicios.data ?? [];
  const grupos = agruparPorCategoria(catalogo);
  const categoriaActiva = categoria ?? grupos[0]?.[0];

  // La cantidad de un servicio en un día: contra las personas DE ESE día (RN-04).
  function cantidadEnDia(dia: EstadoDeDia, servicioId: number, porPersona: boolean) {
    if (!porPersona) return 1;
    const personasDelDia = Number(dia.personas) || 0;
    const manual = dia.elegidos.get(servicioId);
    if (manual === null || manual === undefined) return personasDelDia;
    // RN-04: la cantidad parcial nunca supera a los asistentes. Se recorta acá y no solo al
    // guardarla porque bajar la cantidad de personas después deja la parcial por encima, y el
    // subtotal de esa línea y el del ticket mostrarían un importe imposible. Con el campo de
    // personas vacío (0) no hay tope todavía y se respeta lo que se eligió.
    return personasDelDia > 0 ? Math.min(manual, personasDelDia) : manual;
  }
  const cantidadDe = (servicioId: number, porPersona: boolean) =>
    cantidadEnDia(diaActual, servicioId, porPersona);

  // Las líneas del ticket de un día: sus salones y sus servicios, con el precio proyectado al último
  // día de la franja.
  function lineasDelDia(dia: EstadoDeDia) {
    const salonesDelDia = dia.salonIds
      .map((id) => salonesVisibles.find((s) => s.id === id))
      .filter((s): s is SalonConDistribuciones => s !== undefined);
    return [
      ...salonesDelDia.map((salon) => ({
        clave: `salon-${salon.id}`,
        descripcion: `Salón ${salon.nombre}`,
        detalle: nombreDeJornada(dia.jornada),
        subtotal: precioDeSalonEn(salon, dia.jornada),
        aCotizar: false,
      })),
      ...catalogo
        .filter((s) => dia.elegidos.has(s.id))
        .map((s) => {
          const cantidad = cantidadEnDia(dia, s.id, s.porPersona);
          const aLas = dia.horas.get(s.id) ? ` · a las ${dia.horas.get(s.id)}` : '';
          const modalidad = dia.modalidades.get(s.id) ?? 'Normal';
          const conModalidad = modalidad === 'Normal' ? '' : ` · ${textoModalidad(modalidad)}`;
          const precio = precioDeServicioCon(s, modalidad);
          // HU-11: un tercerizado sin precio fijo entra "a cotizar": sin importe y sin sumar.
          if (precio === null) {
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
                ? `${cantidad} × ${formatearPesos(precio)}`
                : `Precio fijo · ${formatearPesos(precio)}`) +
              conModalidad +
              aLas,
            subtotal: precio * cantidad,
            aCotizar: false,
          };
        }),
    ];
  }
  // Un bloque por día; con un solo día es el ticket de siempre.
  const bloques = Array.from({ length: cantidadDeDias }, (_, i) => {
    const dia = tipo === 'Social' ? diaVacio() : (dias[i] ?? diaVacio());
    return { indice: i, fecha: fechas[i], dia, lineas: lineasDelDia(dia) };
  });
  const lineas = bloques.flatMap((bloque) => bloque.lineas);
  const { subtotal, iva, total } = desglosarIva(
    // Los tercerizados suman como cualquier servicio (dominio.md, 24/09/2026). Un solo total para
    // todos los días.
    lineas.reduce((suma, l) => suma + l.subtotal, 0),
  );

  function alternarServicio(servicioId: number) {
    setElegidos((anteriores) => {
      const siguientes = new Map(anteriores);
      if (siguientes.has(servicioId)) siguientes.delete(servicioId);
      else siguientes.set(servicioId, null);
      return siguientes;
    });
    // Un servicio que se destilda se lleva su hora y su modalidad: si vuelve a elegirse, arranca
    // sin hora y en Normal.
    setHoras((anteriores) => {
      const siguientes = new Map(anteriores);
      siguientes.delete(servicioId);
      return siguientes;
    });
    setModalidades((anteriores) => {
      const siguientes = new Map(anteriores);
      siguientes.delete(servicioId);
      return siguientes;
    });
  }

  function cambiarModalidad(servicioId: number, modalidad: ModalidadServicio) {
    setModalidades((anteriores) => new Map(anteriores).set(servicioId, modalidad));
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
      const numero =
        cantidadPersonas > 0 ? Math.min(Number(valor), cantidadPersonas) : Number(valor);
      siguientes.set(servicioId, valor === '' || numero === cantidadPersonas ? null : numero);
      return siguientes;
    });
  }

  function validarEvento(nuevosErrores: Record<string, string>) {
    if (!fecha) nuevosErrores['fecha'] = 'Elegí la fecha del evento';
    else if (fecha < hoyISO()) nuevosErrores['fecha'] = 'La fecha no puede ser anterior a hoy';
    if (!tipo) nuevosErrores['tipo'] = 'Elegí si es un evento corporativo o social';
  }

  // HU-50: cada día se valida con lo suyo (personas, salón, cantidad de cada servicio).
  function validarDias(): Record<number, Record<string, string>> {
    const porDia: Record<number, Record<string, string>> = {};
    for (let i = 0; i < cantidadDeDias; i++) {
      const dia = dias[i] ?? diaVacio();
      const errores: Record<string, string> = {};
      const personasDelDia = Number(dia.personas) || 0;
      if (personasDelDia < 1) errores['personas'] = 'Ingresá la cantidad de personas';
      if (tipo === 'Corporativo') {
        // La capacidad no bloquea: un evento se puede repartir de muchas formas y el salón chico
        // puede ser el correcto igual. La ficha de cada salón avisa, pero deja elegir.
        if (dia.salonIds.length === 0) errores['salon'] = 'Elegí al menos un salón';
        for (const [id, cantidad] of dia.elegidos) {
          if (cantidad !== null && (cantidad < 1 || cantidad > personasDelDia)) {
            errores['servicios'] =
              'La cantidad de cada servicio tiene que estar entre 1 y el total de personas';
            errores[`servicio-${id}`] = 'Cantidad inválida';
          }
        }
      }
      if (Object.keys(errores).length > 0) porDia[i] = errores;
    }
    return porDia;
  }

  function mostrarErrores(
    nuevosErrores: Record<string, string>,
    nuevosErroresDeDias: Record<number, Record<string, string>> = {},
  ) {
    setErrores(nuevosErrores);
    setErroresDeDias(nuevosErroresDeDias);
    const diasConError = Object.keys(nuevosErroresDeDias).map(Number);
    const hayErrores = Object.keys(nuevosErrores).length > 0 || diasConError.length > 0;
    // Se salta al primer día con un problema, así el aviso está donde hay que corregir.
    if (diasConError.length > 0 && !(activo in nuevosErroresDeDias)) {
      setIndiceActivo(Math.min(...diasConError));
    }
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
    if (horaFin && !hora) nuevosErrores['hora'] = 'Indicá también la hora de inicio';
    else if (horaFin && horaFin === hora)
      nuevosErrores['horaFin'] = 'La hora de fin tiene que ser distinta de la de inicio';
    // Una consulta social tiene un solo grupo de datos para todos los días: se valida el primero.
    const personasSocial = Number(dias[0]?.personas) || 0;
    if (personasSocial < 1) nuevosErrores['personas'] = 'Ingresá la cantidad de personas';
    if (mostrarErrores(nuevosErrores) || !tipoSocial || !perfil.data) return;

    const cliente = { ...perfil.data, nombre: nombreCompleto(perfil.data) };
    const consulta = {
      fecha,
      // HU-50: con un segundo clic en otro día, el evento dura hasta ese día.
      fechaFin: fechaFin && fechaFin !== fecha ? fechaFin : undefined,
      cantidadPersonas: personasSocial,
      // La API la sigue pidiendo: sale del horario. Sin precio de por medio no cambia nada más.
      tipoJornada: jornadaDeHoras(hora, horaFin),
      horaInicioEstimada: hora || undefined,
      horaFinEstimada: horaFin || undefined,
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
    const erroresPorDia = validarDias();
    if (mostrarErrores(nuevosErrores, erroresPorDia) || !perfil.data) return;

    // Lo que se manda de cada día, con sus salones (solo los publicados), personas, jornada y
    // servicios. Con un solo día es la misma franja de un día de siempre.
    const diasDelPedido = fechas.map((fechaDelDia, i) => {
      const dia = dias[i] ?? diaVacio();
      const personasDelDia = Number(dia.personas) || 0;
      return {
        fecha: fechaDelDia,
        cantidadPersonas: personasDelDia,
        tipoJornada: dia.jornada,
        salones: dia.salonIds
          .map((id) => salonesVisibles.find((s) => s.id === id))
          .filter((s): s is SalonConDistribuciones => s !== undefined),
        servicios: catalogo
          .filter((s) => dia.elegidos.has(s.id))
          .map((s) => ({
            servicioId: s.id,
            cantidad: cantidadEnDia(dia, s.id, s.porPersona),
            horaEstimada: dia.horas.get(s.id) || undefined,
            modalidad: dia.modalidades.get(s.id) ?? 'Normal',
          })),
      };
    });

    // La solicitud y el presupuesto guardan el nombre completo, como lo cargaba el formulario.
    const cliente = { ...perfil.data, nombre: nombreCompleto(perfil.data) };
    solicitar.mutate(
      {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        correo: cliente.correo,
        dias: diasDelPedido.map((dia) => ({
          fecha: dia.fecha,
          cantidadPersonas: dia.cantidadPersonas,
          tipoJornada: dia.tipoJornada,
          salonIds: dia.salones.map((s) => s.id),
          servicios: dia.servicios,
        })),
        // Los servicios de cada día van dentro del día.
        servicios: [],
        // La hora estimada de inicio es una sola para todos los días: el horario exacto de cada
        // día lo fija el Responsable de Eventos al agendar.
        horaInicioEstimada: hora || undefined,
      },
      {
        onSuccess: (presupuesto) =>
          onGenerado({
            tipo: 'Corporativo',
            presupuesto,
            salones: diasDelPedido[0]!.salones,
            tipoJornada: diasDelPedido[0]!.tipoJornada,
            cliente,
            dias:
              diasDelPedido.length > 1
                ? diasDelPedido.map(({ servicios: _servicios, ...dia }) => dia)
                : undefined,
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
          <Paso
            numero={1}
            titulo="Tu evento"
            bajada={
              variosDias
                ? 'Las fechas. La cantidad de personas, los salones y la gastronomía los cargás día por día.'
                : 'Fecha e invitados.'
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fecha" className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-dorado" /> Fecha del evento
                </Label>
                {/* HU-50: un clic es el día de inicio; con un segundo clic el evento dura hasta ese
                    día (hasta 32 días). Sin segundo clic, dura uno solo. */}
                <SelectorRangoFechas
                  id="fecha"
                  diaMinimo={hoyISO()}
                  inicio={fecha}
                  fin={fechaFin}
                  onChange={elegirFranja}
                  placeholder="Elegí el día, o el primero y el último"
                  className="h-11"
                  aria-invalid={!!errores['fecha']}
                />
                {errores['fecha'] ? (
                  <p className="text-xs text-destructive">{errores['fecha']}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Si dura varios días, tocá el primero y después el último.
                  </p>
                )}
              </div>
              {!variosDias && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="personas" className="inline-flex items-center gap-1.5">
                    <Users className="size-4 text-dorado" /> Cantidad de personas
                  </Label>
                  <InputEntero
                    id="personas"
                    max={MAXIMO_PERSONAS_EVENTO}
                    placeholder="Ej: 50"
                    value={personas}
                    onChangeValor={setPersonas}
                    className="h-11"
                  />
                  {errores['personas'] ? (
                    <p className="text-xs text-destructive">{errores['personas']}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Hasta {MAXIMO_PERSONAS_EVENTO} personas. Para un evento más grande,
                      consultanos.
                    </p>
                  )}
                </div>
              )}
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

                {/* Sin salón no hay precio que dependa de la duración: alcanza con el horario. */}
                <div className="mt-6 grid gap-5 border-t border-dashed border-border pt-5 sm:grid-cols-2">
                  <CampoHora
                    id="hora"
                    etiqueta="Hora de inicio estimada"
                    value={hora}
                    onChange={setHora}
                    error={errores['hora']}
                  />
                  <CampoHora
                    id="hora-fin"
                    etiqueta="Hora de fin estimada"
                    value={horaFin}
                    onChange={setHoraFin}
                    horaSugerida={hora || undefined}
                    error={errores['horaFin']}
                  />
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Si termina después de la medianoche, elegí la hora de la madrugada: se toma como
                    del día siguiente.
                  </p>
                </div>
              </div>
            )}
          </Paso>

          {variosDias && (
            <Paso
              numero={3}
              titulo="Armá cada día"
              bajada="Cada día tiene sus propias personas, salones y gastronomía. Pasá de un día a otro sin perder lo que cargaste."
            >
              <div
                role="tablist"
                aria-label="Días del evento"
                className="flex gap-2 overflow-x-auto pb-2"
              >
                {fechas.map((fechaDelDia, i) => {
                  const dia = dias[i] ?? diaVacio();
                  const personasDelDia = Number(dia.personas) || 0;
                  const completo = personasDelDia > 0 && dia.salonIds.length > 0;
                  return (
                    <button
                      key={fechaDelDia}
                      type="button"
                      role="tab"
                      aria-selected={i === activo}
                      onClick={() => setIndiceActivo(i)}
                      className={cn(
                        'shrink-0 rounded-xl border-2 px-3 py-2 text-left text-xs transition-colors',
                        i === activo
                          ? 'border-bordo bg-bordo/5'
                          : 'border-border hover:border-dorado',
                        i in erroresDeDias && 'border-destructive',
                      )}
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-bordo">
                        Día {i + 1} · <span className="capitalize">{nombreDeDia(fechaDelDia)}</span>
                        {completo && <Check className="size-3.5 text-emerald-700" />}
                      </span>
                      <span className="block text-muted-foreground">
                        {personasDelDia > 0 ? `${personasDelDia} personas` : 'sin personas'} ·{' '}
                        {dia.salonIds.length} {dia.salonIds.length === 1 ? 'salón' : 'salones'} ·{' '}
                        {dia.jornada === 'completa' ? 'completa' : 'media'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-dashed border-border pt-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="personas" className="inline-flex items-center gap-1.5">
                    <Users className="size-4 text-dorado" /> Personas el día {activo + 1}
                  </Label>
                  <InputEntero
                    id="personas"
                    max={MAXIMO_PERSONAS_EVENTO}
                    placeholder="Ej: 50"
                    value={personas}
                    onChangeValor={setPersonas}
                    className="h-11 w-40"
                    aria-invalid={!!errores['personas']}
                  />
                  {errores['personas'] && (
                    <p className="text-xs text-destructive">{errores['personas']}</p>
                  )}
                </div>
                {activo > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={copiarDiaAnterior}
                  >
                    <Copy /> Copiar el día anterior
                  </Button>
                )}
              </div>
              {Object.keys(erroresDeDias).some((i) => Number(i) !== activo) && (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Falta completar{' '}
                  {Object.keys(erroresDeDias)
                    .map(Number)
                    .filter((i) => i !== activo)
                    .map((i) => `el día ${i + 1}`)
                    .join(', ')}
                  .
                </p>
              )}
            </Paso>
          )}

          {tipo === 'Corporativo' && (
            <Paso
              numero={variosDias ? 4 : 3}
              titulo="Elegí los salones"
              bajada="Uno o varios, hasta los cinco: la gente se puede repartir entre salones. Precios por evento, sin IVA. Abajo elegís la duración y ves cómo cambia el total."
            >
              {variosDias && (
                <p className="mb-4 text-sm font-medium text-bordo">
                  Día {activo + 1} de {cantidadDeDias} ·{' '}
                  <span className="capitalize">{nombreDeDia(fechas[activo]!)}</span>
                </p>
              )}
              {salones.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
              {cantidadPersonas > 0 && entran.length === 0 && masGrande && (
                <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  Ningún salón cubre {cantidadPersonas} personas por sí solo: el más grande es{' '}
                  {masGrande.nombre}, hasta {masGrande.capacidadMaxima}. Podés combinar varios, o
                  elegir el que prefieras y lo resolvemos con vos.
                </p>
              )}
              {errores['salon'] && (
                <p className="mb-4 text-sm text-destructive">{errores['salon']}</p>
              )}
              <div className="grid gap-3">
                {salonesVisibles.map((salon) => {
                  const superaCapacidad = cantidadPersonas > salon.capacidadMaxima;
                  const elegido = salonIds.includes(salon.id);
                  return (
                    <button
                      key={salon.id}
                      type="button"
                      aria-pressed={elegido}
                      onClick={() => alternarSalon(salon.id)}
                      className={cn(
                        'flex items-center gap-4 overflow-hidden rounded-xl border-2 p-2 pr-4 text-left transition-all',
                        elegido
                          ? 'border-bordo bg-bordo/5 shadow-md'
                          : 'border-border hover:border-dorado',
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
                          {salon.distribuciones
                            .filter((d) => d.activo)
                            .map((d) => d.nombre)
                            .join(', ')}
                        </p>
                        {superaCapacidad && salonIds.length <= 1 && (
                          <p className="text-xs text-amber-700">
                            {cantidadPersonas} personas superan su capacidad. Se puede elegir igual:
                            lo vemos con vos.
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-serif text-lg font-semibold">
                          {formatearPesos(precioDeSalon(salon))}
                        </p>
                        <p className="text-[0.65rem] text-muted-foreground uppercase">+ IVA</p>
                      </div>
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border-2',
                          elegido ? 'border-bordo bg-bordo text-crema' : 'border-input',
                        )}
                      >
                        {elegido && <Check className="size-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Con varios salones lo que importa es la suma: la gente se reparte entre ellos.
                  Es un dato, no un tope: la capacidad no bloquea la elección. */}
              {salonesElegidos.length > 1 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {salonesElegidos.length} salones elegidos · capacidad sumada{' '}
                  <span className="font-medium text-foreground">{capacidadElegida} personas</span>
                  {cantidadPersonas > capacidadElegida && (
                    <span className="text-amber-700">
                      {' '}
                      · {cantidadPersonas} personas la superan, lo vemos con vos
                    </span>
                  )}
                </p>
              )}

              {/* La duración va después de los salones: al cambiarla se actualizan el precio de cada
                  salón y el presupuesto. */}
              <div className="mt-6 space-y-5 border-t border-dashed border-border pt-5">
                <div>
                  <p className="text-sm font-medium">¿Cuánto dura tu evento?</p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    El precio de cada salón y tu presupuesto se ajustan a la duración que elijas.
                  </p>
                  <OpcionesJornada jornada={jornada} onChange={setJornada} />
                </div>
                <CampoHora
                  id="hora-corporativo"
                  etiqueta={
                    variosDias
                      ? 'Hora de inicio estimada (la misma para todos los días)'
                      : 'Hora de inicio estimada'
                  }
                  value={hora}
                  onChange={setHora}
                  className="sm:max-w-[calc(50%-0.625rem)]"
                />
              </div>
            </Paso>
          )}

          {tipo === 'Corporativo' && (
            <Paso
              numero={variosDias ? 5 : 4}
              titulo="Sumá la gastronomía"
              bajada={
                variosDias
                  ? 'Opcional. La gastronomía se carga día por día: la de un día no se suma a los demás. Podés contratar un servicio para menos personas que las de ese día.'
                  : 'Opcional. Podés contratar un servicio para menos personas que el total.'
              }
            >
              {variosDias && (
                <p className="mb-4 text-sm font-medium text-bordo">
                  Día {activo + 1} de {cantidadDeDias} ·{' '}
                  <span className="capitalize">{nombreDeDia(fechas[activo]!)}</span>
                </p>
              )}
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

              {/* Cada servicio es una tarjeta con el mismo formato que los salones: foto, nombre y
                  descripción, precio y la marca de elegido. Sin foto propia no se deja el hueco:
                  el texto ocupa todo el ancho, como en la carta de la landing. Las opciones del
                  servicio elegido van debajo, dentro de la tarjeta pero fuera del botón, porque un
                  botón no puede tener campos adentro. */}
              <ul className="mt-5 grid gap-3">
                {(grupos.find(([nombre]) => nombre === categoriaActiva)?.[1] ?? []).map(
                  (servicio) => {
                    const marcado = elegidos.has(servicio.id);
                    const precio =
                      servicio.precio === null
                        ? 'A cotizar'
                        : formatearPesos(
                            servicio.tercerizado ? servicio.precio : proyectar(servicio.precio),
                          );
                    const unidad = servicio.porPersona ? 'por persona' : 'precio fijo';
                    return (
                      <li
                        key={servicio.id}
                        className={cn(
                          'overflow-hidden rounded-xl border-2 transition-all',
                          marcado
                            ? 'border-bordo bg-bordo/5 shadow-md'
                            : 'border-border hover:border-dorado',
                        )}
                      >
                        <button
                          type="button"
                          aria-pressed={marcado}
                          onClick={() => alternarServicio(servicio.id)}
                          className={cn(
                            'flex w-full items-center gap-3 p-2 pr-4 text-left sm:gap-4',
                            !servicio.fotoUrl && 'py-3 pl-4',
                          )}
                        >
                          {servicio.fotoUrl && (
                            <img
                              src={fotoOptimizada(servicio.fotoUrl, 200)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="size-16 shrink-0 rounded-lg object-cover sm:size-20"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block font-serif text-lg leading-snug font-semibold text-bordo">
                              {servicio.nombre}
                            </span>
                            {/* Sin `block`: le ganaba al display de line-clamp y la descripción
                                salía entera. */}
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {servicio.descripcion}
                            </span>
                            {/* En pantallas angostas el precio va debajo del texto: al costado le
                                dejaba al nombre una palabra por renglón. */}
                            <span className="mt-1 block font-serif font-semibold sm:hidden">
                              {precio}{' '}
                              <span className="font-sans text-[0.65rem] font-normal text-muted-foreground uppercase">
                                {unidad}
                              </span>
                            </span>
                          </div>
                          <div className="hidden shrink-0 text-right sm:block">
                            <p className="font-serif text-lg font-semibold">{precio}</p>
                            <p className="text-[0.65rem] text-muted-foreground uppercase">
                              {unidad}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded-md border-2',
                              marcado ? 'border-bordo bg-bordo text-crema' : 'border-input',
                            )}
                          >
                            {marcado && <Check className="size-3" />}
                          </span>
                        </button>
                        {marcado && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 border-t border-dashed border-bordo/20 px-4 py-3 text-xs text-muted-foreground">
                            {servicio.porPersona && (
                              <>
                                Para
                                <CantidadDeServicio
                                  aria-label={`Para cuántas personas es ${servicio.nombre}`}
                                  max={cantidadPersonas || undefined}
                                  valor={cantidadDe(servicio.id, true)}
                                  onCambio={(valor) => cambiarCantidad(servicio.id, valor)}
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
                            <SelectorHora
                              id={`hora-${servicio.id}`}
                              value={horas.get(servicio.id) ?? ''}
                              onChange={(valor) => cambiarHora(servicio.id, valor)}
                              horaSugerida={hora || undefined}
                              opcional
                              placeholder="--:--"
                              className="h-8 w-32"
                            />
                            <span>(opcional)</span>
                            {servicio.admiteModalidad && (
                              <>
                                <label htmlFor={`modalidad-${servicio.id}`} className="ml-2">
                                  Servicio
                                </label>
                                <SelectorModalidad
                                  id={`modalidad-${servicio.id}`}
                                  value={modalidadDe(servicio.id)}
                                  onChange={(modalidad) => cambiarModalidad(servicio.id, modalidad)}
                                />
                              </>
                            )}
                            {cantidadPersonas > 0 && servicio.precio !== null && (
                              <span className="ml-auto font-medium text-foreground">
                                {formatearPesos(
                                  (precioDeServicio(servicio) ?? 0) *
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
              hora={hora}
              horaFin={horaFin}
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
                  {!fecha
                    ? 'Sin fecha'
                    : variosDias
                      ? `${fecha.split('-').reverse().join('/')} al ${fechas[fechas.length - 1]!.split('-').reverse().join('/')} · ${textoDeDias(fecha, fechaFin)}`
                      : fecha.split('-').reverse().join('/')}{' '}
                  ·{' '}
                  {variosDias
                    ? bloques.some((b) => Number(b.dia.personas) > 0)
                      ? textoDePersonas(
                          bloques.map((b) => Number(b.dia.personas) || 0).filter((n) => n > 0),
                        )
                      : 'sin personas'
                    : cantidadPersonas > 0
                      ? `${cantidadPersonas} personas`
                      : 'sin personas'}
                  {variosDias && (
                    <>
                      {' · '}
                      {resumenDeJornada(bloques.map((b) => b.dia.jornada)).texto}
                    </>
                  )}
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
                  <div className="space-y-5">
                    {bloques.map((bloque) => (
                      <div key={bloque.indice}>
                        {/* HU-50: con varios días, el detalle va día por día y un único total abajo. */}
                        {variosDias && bloque.fecha && (
                          <p className="mb-2 text-xs font-semibold tracking-wide text-bordo uppercase">
                            Día {bloque.indice + 1} ·{' '}
                            <span className="capitalize">{nombreDeDia(bloque.fecha)}</span>
                            <span className="ml-2 font-normal text-muted-foreground normal-case">
                              {Number(bloque.dia.personas) > 0
                                ? `${bloque.dia.personas} personas`
                                : 'sin personas'}
                            </span>
                          </p>
                        )}
                        {bloque.lineas.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Todavía sin salón.</p>
                        ) : (
                          <ul className="space-y-3 text-sm">
                            {bloque.lineas.map((linea) => (
                              <li key={linea.clave} className="flex justify-between gap-3">
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">
                                    {linea.descripcion}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {linea.detalle}
                                  </span>
                                </span>
                                <span className="shrink-0 font-medium">
                                  {linea.aCotizar ? 'A cotizar' : formatearPesos(linea.subtotal)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
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
                  {meses > 0 && Number(porcentajeMensual) > 0
                    ? `Precios proyectados a la fecha del evento (+${porcentajeMensual}% por mes)`
                    : `Precios de ${mesVigente}`}
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
  hora,
  horaFin,
  tipoSocial,
  detalleOtro,
  error,
  enviando,
  deshabilitado,
  onEnviar,
}: {
  fecha: string;
  cantidadPersonas: number;
  hora: string;
  horaFin: string;
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
    ['Horario estimado', textoHorarioEstimado(hora, horaFin)],
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
              <dt className="shrink-0 text-muted-foreground">{etiqueta}</dt>
              <dd className="min-w-0 text-right font-medium break-words">{valor}</dd>
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
