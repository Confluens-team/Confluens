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
  MAXIMO_COMENTARIOS_CLIENTE,
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
import { Textarea } from '@/components/ui/textarea';
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
import { horaDentroDelHorario, jornadaDeHoras, textoHorarioEstimado } from '@/lib/jornada';
import { textoDeDias } from '@/lib/rango-de-fechas';
import { cn } from '@/lib/utils';
import { CopiarDiaCargado, type OpcionDeCopia } from './cotizador/CopiarDiaCargado';
import { TarjetaDia } from './cotizador/TarjetaDia';

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
    // Lo que el cliente quiso contar de su evento, con cualquier tipo de evento social.
    comentarios?: string;
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
  bajada?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-8">
      <div className={cn('flex gap-4', bajada ? 'items-start' : 'items-center')}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bordo font-serif text-sm text-crema">
          {numero}
        </span>
        <div>
          <h2 className="text-xl font-semibold text-bordo">{titulo}</h2>
          {bajada && <p className="text-sm text-muted-foreground">{bajada}</p>}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
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

// HU-50: lo que cambia de un día a otro en un evento corporativo. Cada día tiene sus personas, su
// horario, sus salones y sus servicios; lo del evento entero (las fechas, el tipo) no.
interface EstadoDeDia {
  personas: string;
  // S-16: el horario estimado del día ("HH:mm"), que se guarda por día. La jornada sale de acá
  // (media: hasta 4 horas inclusive; completa: más de 4).
  horaDesde: string;
  horaHasta: string;
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
  horaDesde: '',
  horaHasta: '',
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

// La jornada de un día sale de su horario. Sin horario todavía se toma completa, para mostrar algún
// precio de los salones mientras se carga.
const jornadaDe = (dia: EstadoDeDia) => jornadaDeHoras(dia.horaDesde, dia.horaHasta);
const tieneHorario = (dia: EstadoDeDia) =>
  !!dia.horaDesde && !!dia.horaHasta && dia.horaDesde !== dia.horaHasta;
// La hora pedida para un servicio cae fuera del horario del día (por ejemplo, porque después se
// achicó el horario). Sin hora o sin horario completo no hay nada que marcar.
const horaFueraDelHorario = (dia: EstadoDeDia, servicioId: number) => {
  const hora = dia.horas.get(servicioId);
  return !!hora && tieneHorario(dia) && !horaDentroDelHorario(hora, dia.horaDesde, dia.horaHasta);
};
// Un día está listo con personas, al menos un salón, su horario y cada servicio dentro de él.
const diaCompleto = (dia: EstadoDeDia) =>
  (Number(dia.personas) || 0) > 0 &&
  dia.salonIds.length > 0 &&
  tieneHorario(dia) &&
  [...dia.horas.keys()].every((id) => !horaFueraDelHorario(dia, id));
const diaEmpezado = (dia: EstadoDeDia) =>
  dia.personas !== '' ||
  dia.salonIds.length > 0 ||
  dia.horaDesde !== '' ||
  dia.horaHasta !== '' ||
  dia.elegidos.size > 0;

const formateadorDiaSemana = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  timeZone: 'UTC',
});
const formateadorFechaLarga = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
// «lun 16/11»: el día de la semana y la fecha, para los títulos de cada día.
const nombreDeDia = (fecha: string) => {
  const [, mes = '', dia = ''] = fecha.split('-');
  const semana = formateadorDiaSemana.format(new Date(`${fecha}T00:00:00Z`)).replace('.', '');
  return `${semana} ${dia}/${mes}`;
};
// «jueves 10 de diciembre», para el resumen del paso 1.
const fechaLarga = (fecha: string) =>
  formateadorFechaLarga.format(new Date(`${fecha}T00:00:00Z`)).replace(',', '');

function precioSalon(salon: SalonConDistribuciones, jornada: TipoJornada) {
  return jornada === 'completa' ? salon.precioJornadaCompleta : salon.precioMediaJornada;
}

// Los errores de un día como una sola frase, para la tarjeta cerrada.
const mensajeDeErrores = (errores: Record<string, string> | undefined) =>
  errores
    ? [
        ...new Set(
          Object.entries(errores)
            .filter(([clave]) => !clave.startsWith('servicio-'))
            .map(([, mensaje]) => mensaje),
        ),
      ].join('. ')
    : undefined;

// El cartel de la jornada: sale del horario del día, no se elige (diseño del cotizador por días).
function CartelJornada({ dia }: { dia: EstadoDeDia }) {
  if (!tieneHorario(dia)) {
    return (
      <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        Con el horario te decimos si es <strong>media jornada</strong> (hasta 4 horas) o{' '}
        <strong>jornada completa</strong>.
      </p>
    );
  }
  const jornada = jornadaDe(dia);
  return (
    <p className="rounded-lg bg-dorado/15 px-3 py-2.5 text-sm text-dorado-texto" aria-live="polite">
      <strong>{nombreDeJornada(jornada)}</strong> ·{' '}
      {jornada === 'media' ? 'hasta 4 horas' : 'más de 4 horas'}
    </p>
  );
}

// Cotizador del cliente registrado: la vista con precios de la landing. Primero el evento (las
// fechas y el tipo) y después, si es corporativo, cada día (ADR 0008, HU-50):
// - Corporativo: cada día es una tarjeta con sus personas, su horario, sus salones y su
//   gastronomía, y el total estimado se ve en vivo; el presupuesto que vale es el que devuelve
//   POST /presupuestos (HU-09), que es donde viven las reglas de cálculo.
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

  // HU-50: la franja del evento. Con un solo día, `fechaFin` es igual a `fecha`.
  const [fecha, setFecha] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  // Lo de cada día, por posición en la franja. Al cambiar las fechas en el paso 1 se conserva por
  // posición; al sumar o sacar días desde el calendario, cada día sigue en su fecha.
  const [dias, setDias] = useState<EstadoDeDia[]>(() => [
    diaVacio(salonInicialId ? [salonInicialId] : []),
  ]);
  // La tarjeta abierta: una sola a la vez (null, todas cerradas).
  const [diaAbierto, setDiaAbierto] = useState<number | null>(0);
  // El paso 1 se resume en una línea cuando el cliente sigue con los días.
  const [pasoUnoAbierto, setPasoUnoAbierto] = useState(true);
  // El paso 2 aparece recién con el botón del paso 1. Una vez habilitado queda: si después se
  // cambian las fechas, lo cargado de cada día sigue a la vista.
  const [pasoDosHabilitado, setPasoDosHabilitado] = useState(false);
  // Solo en un evento social, que no carga día por día: cuándo empieza y termina.
  const [hora, setHora] = useState('');
  const [horaFin, setHoraFin] = useState('');
  // Si llega desde un salón de la landing (?salon=), es un evento corporativo.
  const [tipo, setTipo] = useState<TipoEvento | undefined>(
    salonInicialId ? 'Corporativo' : undefined,
  );
  const [tipoSocial, setTipoSocial] = useState<TipoEventoSocial | undefined>();
  const [detalleOtro, setDetalleOtro] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [erroresGlobales, setErrores] = useState<Record<string, string>>({});
  // Los errores de cada día, por posición: al validar se marcan las tarjetas y se abre la primera.
  const [erroresDeDias, setErroresDeDias] = useState<Record<number, Record<string, string>>>({});

  const fechas = fecha ? fechasDeLaFranja(fecha, fechaFin || fecha) : [];
  const cantidadDeDias = Math.max(fechas.length, 1);
  const corporativo = tipo === 'Corporativo';
  const variosDias = corporativo && cantidadDeDias > 1;
  // El día que se está editando. Un evento social no carga días: usa siempre el primero.
  const activo = tipo === 'Social' ? 0 : Math.min(diaAbierto ?? 0, cantidadDeDias - 1);
  const diaActual = dias[activo] ?? diaVacio();
  const { personas, salonIds, elegidos, horas, modalidades } = diaActual;
  const jornada = jornadaDe(diaActual);
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
  const setHoraDesde = delActivo('horaDesde');
  const setHoraHasta = delActivo('horaHasta');
  const setSalonIds = delActivo('salonIds');
  const setElegidos = delActivo('elegidos');
  const setHoras = delActivo('horas');
  const setModalidades = delActivo('modalidades');

  function elegirFranja(inicio: string, fin: string) {
    setFecha(inicio);
    setFechaFin(fin);
    setDiaAbierto(0);
  }

  // Abre la tarjeta de un día y la lleva a la vista.
  function irAlDia(indice: number) {
    setDiaAbierto(indice);
    window.setTimeout(
      () =>
        document
          .getElementById(`dia-${indice}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      50,
    );
  }

  // «Copiar día cargado»: le pasa al día `hacia` todo lo del día `desde` (personas, horario,
  // salones y servicios), para cambiar después solo lo distinto.
  function copiarDia(desde: number, hacia: number) {
    setDias((anteriores) => {
      const siguientes = [...anteriores];
      while (siguientes.length <= Math.max(desde, hacia)) siguientes.push(diaVacio());
      siguientes[hacia] = copiaDeDia(siguientes[desde]!);
      return siguientes;
    });
    setErroresDeDias((anteriores) => {
      const siguientes = { ...anteriores };
      delete siguientes[hacia];
      return siguientes;
    });
    irAlDia(hacia);
  }

  const cantidadPersonas = Number(personas) || 0;
  // El cliente solo ve los salones publicados (HU-08), igual que en la landing.
  const salonesVisibles = (salones.data ?? []).filter((s) => s.visibleEnLanding);
  const salonesDe = (dia: EstadoDeDia) =>
    dia.salonIds
      .map((id) => salonesVisibles.find((s) => s.id === id))
      .filter((s): s is SalonConDistribuciones => s !== undefined);
  const salonesElegidos = salonesDe(diaActual);
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
    const jornadaDelDia = jornadaDe(dia);
    return [
      ...salonesDe(dia).map((salon) => ({
        clave: `salon-${salon.id}`,
        descripcion: `Salón ${salon.nombre}`,
        detalle: nombreDeJornada(jornadaDelDia),
        subtotal: precioDeSalonEn(salon, jornadaDelDia),
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
    const lineasDeEsteDia = lineasDelDia(dia);
    return {
      indice: i,
      fecha: fechas[i],
      dia,
      lineas: lineasDeEsteDia,
      subtotal: lineasDeEsteDia.reduce((suma, l) => suma + l.subtotal, 0),
      completo: diaCompleto(dia),
      empezado: diaEmpezado(dia),
    };
  });
  const lineas = bloques.flatMap((bloque) => bloque.lineas);
  const { subtotal, iva, total } = desglosarIva(
    // Los tercerizados suman como cualquier servicio (dominio.md, 24/09/2026). Un solo total para
    // todos los días.
    lineas.reduce((suma, l) => suma + l.subtotal, 0),
  );
  const diasListos = bloques.filter((b) => b.completo).length;
  const diasEmpezados = bloques.filter((b) => !b.completo && b.empezado).length;
  // El primer día que falta completar: con varios días, el botón de enviar avisa cuál es.
  const primerDiaIncompleto = variosDias ? bloques.findIndex((b) => !b.completo) : -1;

  // Los chips de una tarjeta cerrada: personas, salones, horario y cada servicio.
  function resumenDelDia(dia: EstadoDeDia): string[] {
    const chips: string[] = [];
    const personasDelDia = Number(dia.personas) || 0;
    if (personasDelDia > 0) chips.push(`${personasDelDia} personas`);
    const nombres = salonesDe(dia).map((s) => s.nombre);
    if (nombres.length > 0) chips.push(nombres.join(' + '));
    if (tieneHorario(dia)) {
      chips.push(
        `${dia.horaDesde} – ${dia.horaHasta} · ${nombreDeJornada(jornadaDe(dia)).toLowerCase()}`,
      );
    }
    for (const servicio of catalogo.filter((s) => dia.elegidos.has(s.id))) {
      const aLas = dia.horas.get(servicio.id);
      const modalidad = dia.modalidades.get(servicio.id) ?? 'Normal';
      chips.push(
        servicio.nombre +
          (aLas ? ` ${aLas}` : '') +
          (modalidad === 'Normal' ? '' : ` · ${textoModalidad(modalidad).toLowerCase()}`),
      );
    }
    return chips;
  }

  // Los días que se pueden copiar en el día `indice`: los otros que ya están completos.
  function opcionesDeCopia(indice: number): OpcionDeCopia[] {
    return bloques
      .filter((b) => b.indice !== indice && b.completo && b.fecha)
      .map((b) => ({
        indice: b.indice,
        titulo: `Día ${b.indice + 1} · ${nombreDeDia(b.fecha!)}`,
        detalle: [
          `${Number(b.dia.personas)} personas`,
          salonesDe(b.dia)
            .map((s) => s.nombre)
            .join(' + '),
          `${b.dia.horaDesde} a ${b.dia.horaHasta}`,
        ].join(' · '),
      }));
  }

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

  // HU-50: cada día se valida con lo suyo (personas, horario, salón, cantidad de cada servicio).
  function validarDia(dia: EstadoDeDia): Record<string, string> {
    const erroresDelDia: Record<string, string> = {};
    const personasDelDia = Number(dia.personas) || 0;
    if (personasDelDia < 1) erroresDelDia['personas'] = 'Ingresá la cantidad de personas';
    if (tipo === 'Corporativo') {
      if (!dia.horaDesde || !dia.horaHasta) erroresDelDia['horario'] = 'Indicá el horario del día';
      else if (dia.horaDesde === dia.horaHasta)
        erroresDelDia['horario'] = 'La hora de fin tiene que ser distinta de la de inicio';
      // La capacidad no bloquea: un evento se puede repartir de muchas formas y el salón chico
      // puede ser el correcto igual. La ficha de cada salón avisa, pero deja elegir.
      if (dia.salonIds.length === 0) erroresDelDia['salon'] = 'Elegí al menos un salón';
      for (const [id, cantidad] of dia.elegidos) {
        if (cantidad !== null && (cantidad < 1 || cantidad > personasDelDia)) {
          erroresDelDia['servicios'] =
            'La cantidad de cada servicio tiene que estar entre 1 y el total de personas';
          erroresDelDia[`servicio-${id}`] = 'Cantidad inválida';
        }
        if (horaFueraDelHorario(dia, id)) {
          erroresDelDia['horasDeServicios'] =
            'La hora de cada servicio tiene que estar dentro del horario del día';
        }
      }
    }
    return erroresDelDia;
  }

  function validarDias(): Record<number, Record<string, string>> {
    const porDia: Record<number, Record<string, string>> = {};
    for (let i = 0; i < cantidadDeDias; i++) {
      const erroresDelDia = validarDia(dias[i] ?? diaVacio());
      if (Object.keys(erroresDelDia).length > 0) porDia[i] = erroresDelDia;
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
    const hayErroresDelEvento = Object.keys(nuevosErrores).length > 0;
    if (hayErroresDelEvento) {
      // La fecha o el tipo: se abre el paso 1, que es donde se corrigen.
      setPasoUnoAbierto(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (diasConError.length > 0) {
      // Se abre la tarjeta del primer día con un problema, así el aviso está donde hay que corregir.
      irAlDia(Math.min(...diasConError));
    }
    return hayErroresDelEvento || diasConError.length > 0;
  }

  // «Listo» en una tarjeta: si al día le falta algo se marca; si no, se cierra y se abre el próximo
  // día que falta completar.
  function terminarDia(indice: number) {
    const erroresDelDia = validarDia(dias[indice] ?? diaVacio());
    if (Object.keys(erroresDelDia).length > 0) {
      setErroresDeDias((anteriores) => ({ ...anteriores, [indice]: erroresDelDia }));
      return;
    }
    setErroresDeDias((anteriores) => {
      const siguientes = { ...anteriores };
      delete siguientes[indice];
      return siguientes;
    });
    const siguiente = siguienteIncompleto(indice);
    if (siguiente === null) setDiaAbierto(null);
    else irAlDia(siguiente);
  }

  // El próximo día sin completar después de `indice` (o antes, si después están todos).
  function siguienteIncompleto(indice: number): number | null {
    const pendientes = bloques.filter((b) => b.indice !== indice && !b.completo);
    return (pendientes.find((b) => b.indice > indice) ?? pendientes[0])?.indice ?? null;
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
      // HU-50: con más de un día, el evento dura hasta el último.
      fechaFin: fechaFin && fechaFin !== fecha ? fechaFin : undefined,
      cantidadPersonas: personasSocial,
      // La API la sigue pidiendo: sale del horario. Sin precio de por medio no cambia nada más.
      tipoJornada: jornadaDeHoras(hora, horaFin),
      horaInicioEstimada: hora || undefined,
      horaFinEstimada: horaFin || undefined,
      tipoSocial,
      tipoSocialDetalle: tipoSocial === 'Otro' ? detalleOtro.trim() : undefined,
      comentarios: comentarios.trim() || undefined,
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

    // Lo que se manda de cada día, con sus salones (solo los publicados), personas, jornada,
    // horario (S-16) y servicios. Con un solo día es la misma franja de un día de siempre.
    const diasDelPedido = fechas.map((fechaDelDia, i) => {
      const dia = dias[i] ?? diaVacio();
      return {
        fecha: fechaDelDia,
        cantidadPersonas: Number(dia.personas) || 0,
        tipoJornada: jornadaDe(dia),
        horaInicioEstimada: dia.horaDesde || undefined,
        horaFinEstimada: dia.horaHasta || undefined,
        salones: salonesDe(dia),
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
          horaInicioEstimada: dia.horaInicioEstimada,
          horaFinEstimada: dia.horaFinEstimada,
          salonIds: dia.salones.map((s) => s.id),
          servicios: dia.servicios,
        })),
        // Los servicios de cada día van dentro del día, y el horario también (S-16).
        servicios: [],
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
                ? diasDelPedido.map((dia) => ({
                    fecha: dia.fecha,
                    cantidadPersonas: dia.cantidadPersonas,
                    tipoJornada: dia.tipoJornada,
                    salones: dia.salones,
                  }))
                : undefined,
          }),
      },
    );
  }

  const mesVigente = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const fechasDelEvento = fecha
    ? fechas.length > 1
      ? `del ${fechaLarga(fecha)} al ${fechaLarga(fechas[fechas.length - 1]!)} · ${textoDeDias(fecha, fechaFin)}`
      : fechaLarga(fecha)
    : '';
  const pasoUnoResumido = corporativo && !!fecha && !pasoUnoAbierto;

  // El editor del día que está abierto: personas, horario, salones y gastronomía. Con un solo día
  // va suelto en el paso 2; con varios, dentro de la tarjeta del día.
  const editorDelDia = (
    <div className="flex flex-col gap-7">
      <div className="grid items-start gap-4 sm:grid-cols-3 lg:grid-cols-[9rem_1fr_1fr_1.3fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="personas" className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-dorado" /> Personas
          </Label>
          <InputEntero
            id="personas"
            max={MAXIMO_PERSONAS_EVENTO}
            placeholder="Ej: 50"
            value={personas}
            onChangeValor={setPersonas}
            className="h-11"
            aria-invalid={!!errores['personas']}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hora-desde" className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-dorado" /> Desde
          </Label>
          <SelectorHora
            id="hora-desde"
            value={diaActual.horaDesde}
            onChange={setHoraDesde}
            horaSugerida="09:00"
            placeholder="--:--"
            className="h-11"
            aria-invalid={!!errores['horario'] && !diaActual.horaDesde}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hora-hasta" className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-dorado" /> Hasta
          </Label>
          <SelectorHora
            id="hora-hasta"
            value={diaActual.horaHasta}
            onChange={setHoraHasta}
            horaSugerida={diaActual.horaDesde || '18:00'}
            placeholder="--:--"
            className="h-11"
            aria-invalid={!!errores['horario'] && diaActual.horaDesde !== ''}
          />
        </div>
        <div className="sm:col-span-3 lg:col-span-1 lg:self-end">
          <CartelJornada dia={diaActual} />
        </div>
        {(errores['personas'] || errores['horario']) && (
          <div className="space-y-1 sm:col-span-3 lg:col-span-4">
            {errores['personas'] && (
              <p className="text-xs text-destructive">{errores['personas']}</p>
            )}
            {errores['horario'] && <p className="text-xs text-destructive">{errores['horario']}</p>}
          </div>
        )}
      </div>

      <section className="flex flex-col gap-2.5" aria-label="Salones">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Salones</span>
          <span className="text-xs text-muted-foreground">
            {salonesElegidos.length > 0 && (
              <>
                Capacidad elegida:{' '}
                <strong className="text-foreground">{capacidadElegida} personas</strong> ·{' '}
              </>
            )}
            precios por {nombreDeJornada(jornada).toLowerCase()}, sin IVA
          </span>
        </div>
        {salones.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {cantidadPersonas > 0 && entran.length === 0 && masGrande && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Ningún salón cubre {cantidadPersonas} personas por sí solo: el más grande es{' '}
            {masGrande.nombre}, hasta {masGrande.capacidadMaxima}. Podés combinar varios, o elegir
            el que prefieras y lo resolvemos con vos.
          </p>
        )}
        {errores['salon'] && <p className="text-sm text-destructive">{errores['salon']}</p>}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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
                  'group flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all',
                  elegido
                    ? 'border-bordo bg-bordo/5 shadow-md'
                    : 'border-border hover:border-dorado',
                )}
              >
                {/* La foto del salón arriba, como en la landing, con la marca de elegido encima. */}
                <span className="relative block h-24 overflow-hidden">
                  <img
                    src={fotoDeSalon(salon, 400)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span
                    className={cn(
                      'absolute top-2 right-2 flex size-5 items-center justify-center rounded-md border-2',
                      elegido ? 'border-bordo bg-bordo text-crema' : 'border-white/90 bg-white/70',
                    )}
                  >
                    {elegido && <Check className="size-3" />}
                  </span>
                  {recomendado?.id === salon.id && (
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-crema/95 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-bordo uppercase">
                      <Sparkles className="size-3" /> Recomendado
                    </span>
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="font-serif text-base leading-tight font-semibold text-bordo">
                    {salon.nombre}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Hasta {salon.capacidadMaxima} personas · {salon.superficie} m²
                  </span>
                  <strong className="mt-auto pt-1 text-sm tabular-nums">
                    {formatearPesos(precioDeSalon(salon))}
                  </strong>
                  {superaCapacidad && salonIds.length <= 1 && (
                    <span className="text-[0.7rem] leading-snug text-amber-700">
                      Supera su capacidad: lo vemos con vos
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {/* Con varios salones lo que importa es la suma: la gente se reparte entre ellos.
            Es un dato, no un tope: la capacidad no bloquea la elección. */}
        {salonesElegidos.length > 1 && cantidadPersonas > capacidadElegida && (
          <p className="text-xs text-amber-700">
            {cantidadPersonas} personas superan la capacidad sumada: lo vemos con vos.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Gastronomía">
        <span className="text-sm font-medium">Gastronomía</span>
        {servicios.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {errores['servicios'] && <p className="text-sm text-destructive">{errores['servicios']}</p>}
        {errores['horasDeServicios'] && (
          <p className="text-sm text-destructive">{errores['horasDeServicios']}</p>
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

        {/* Cada servicio es una tarjeta: nombre, descripción, precio y la marca de elegido. Las
            opciones del servicio elegido van debajo, dentro de la tarjeta pero fuera del botón,
            porque un botón no puede tener campos adentro. */}
        <ul className="grid gap-3">
          {(grupos.find(([nombre]) => nombre === categoriaActiva)?.[1] ?? []).map((servicio) => {
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
                  marcado ? 'border-bordo bg-bordo/5' : 'border-border hover:border-dorado',
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
                  {/* Sin foto propia no se deja el hueco: el texto ocupa todo el ancho, como en
                      la carta de la landing. */}
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
                    {/* Sin `block`: le ganaba al display de line-clamp y la descripción salía
                        entera. */}
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {servicio.descripcion}
                    </span>
                    {/* En pantallas angostas el precio va debajo del texto. */}
                    <span className="mt-1 block font-serif font-semibold sm:hidden">
                      {precio}{' '}
                      <span className="font-sans text-[0.65rem] font-normal text-muted-foreground uppercase">
                        {unidad}
                      </span>
                    </span>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="font-serif text-lg font-semibold">{precio}</p>
                    <p className="text-[0.65rem] text-muted-foreground uppercase">{unidad}</p>
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
                    {servicio.admiteModalidad && (
                      <>
                        <label htmlFor={`modalidad-${servicio.id}`}>Servicio</label>
                        <SelectorModalidad
                          id={`modalidad-${servicio.id}`}
                          value={modalidadDe(servicio.id)}
                          onChange={(modalidad) => cambiarModalidad(servicio.id, modalidad)}
                        />
                      </>
                    )}
                    {servicio.porPersona && (
                      <>
                        <span className={servicio.admiteModalidad ? 'ml-2' : undefined}>Para</span>
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
                    {/* Opcional: a qué hora del día se espera el servicio. Es la preferencia del
                        cliente; el horario real lo carga el equipo al agendar. */}
                    <label htmlFor={`hora-${servicio.id}`} className="ml-2">
                      Hora
                    </label>
                    {/* La hora tiene que caer dentro del horario del día: el selector no deja
                        aceptar una afuera, y si después cambia el horario del día se avisa. */}
                    <SelectorHora
                      id={`hora-${servicio.id}`}
                      value={horas.get(servicio.id) ?? ''}
                      onChange={(valor) => cambiarHora(servicio.id, valor)}
                      horaSugerida={diaActual.horaDesde || undefined}
                      horaMinima={tieneHorario(diaActual) ? diaActual.horaDesde : undefined}
                      horaMaxima={tieneHorario(diaActual) ? diaActual.horaHasta : undefined}
                      opcional
                      placeholder="--:--"
                      className="h-8 w-32"
                      aria-invalid={horaFueraDelHorario(diaActual, servicio.id)}
                    />
                    <span>(opcional)</span>
                    {cantidadPersonas > 0 && servicio.precio !== null && (
                      <span className="ml-auto font-medium text-foreground tabular-nums">
                        {formatearPesos(
                          (precioDeServicio(servicio) ?? 0) *
                            cantidadDe(servicio.id, servicio.porPersona),
                        )}
                      </span>
                    )}
                    {horaFueraDelHorario(diaActual, servicio.id) && (
                      <p className="w-full text-destructive">
                        La hora tiene que estar dentro del horario del día ({diaActual.horaDesde} a{' '}
                        {diaActual.horaHasta}).
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );

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
        <div className="flex min-w-0 flex-col gap-6">
          {pasoUnoResumido ? (
            <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border sm:px-8">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bordo font-serif text-sm text-crema">
                1
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-bordo">Tu evento</h2>
                <p className="text-sm text-muted-foreground first-letter:uppercase">
                  Corporativo · {fechasDelEvento}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setPasoUnoAbierto(true)}
              >
                <CalendarDays /> Cambiar fechas
              </Button>
            </section>
          ) : (
            <Paso numero={1} titulo="Tu evento" bajada="Las fechas y qué tipo de evento es.">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fecha" className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-4 text-dorado" /> Fecha del evento
                  </Label>
                  {/* HU-50: arriba del calendario se elige «1 día» o «Más de 1 día» (hasta 32). */}
                  <SelectorRangoFechas
                    id="fecha"
                    conModo
                    diaMinimo={hoyISO()}
                    inicio={fecha}
                    fin={fechaFin}
                    onChange={elegirFranja}
                    placeholder="Elegí el día o los días"
                    className="h-11"
                    aria-invalid={!!errores['fecha']}
                  />
                  {errores['fecha'] && (
                    <p className="text-xs text-destructive">{errores['fecha']}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 border-t border-dashed border-border pt-5">
                <p className="mb-3 text-sm font-medium">¿Qué tipo de evento es?</p>
                {errores['tipo'] && (
                  <p className="mb-3 text-sm text-destructive">{errores['tipo']}</p>
                )}
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
                        <div className="relative h-32 overflow-hidden">
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

                  {/* Sin salón no hay precio que dependa de la duración: alcanza con las personas
                      y el horario. Un evento corporativo carga las personas en cada día. */}
                  <div className="mt-6 grid gap-5 border-t border-dashed border-border pt-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]">
                      <Label htmlFor="personas-social" className="inline-flex items-center gap-1.5">
                        <Users className="size-4 text-dorado" /> Cantidad de personas
                      </Label>
                      <InputEntero
                        id="personas-social"
                        max={MAXIMO_PERSONAS_EVENTO}
                        placeholder="Ej: 50"
                        value={personas}
                        onChangeValor={setPersonas}
                        className="h-11"
                        aria-invalid={!!errores['personas']}
                      />
                      {errores['personas'] && (
                        <p className="text-xs text-destructive">{errores['personas']}</p>
                      )}
                    </div>
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
                      Si termina después de la medianoche, elegí la hora de la madrugada: se toma
                      como del día siguiente.
                    </p>
                  </div>

                  {/* Con cualquier tipo de evento social: lo que el cliente quiera contar. */}
                  <div className="mt-6 flex flex-col gap-1.5 border-t border-dashed border-border pt-5">
                    <Label htmlFor="comentarios-social">
                      Comentarios{' '}
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </Label>
                    <Textarea
                      id="comentarios-social"
                      maxLength={MAXIMO_COMENTARIOS_CLIENTE}
                      rows={4}
                      placeholder="Contanos lo que quieras de tu evento: ideas, pedidos especiales, dudas…"
                      value={comentarios}
                      onChange={(e) => setComentarios(e.target.value)}
                      aria-invalid={!!errores['comentarios']}
                    />
                    {errores['comentarios'] && (
                      <p className="text-xs text-destructive">{errores['comentarios']}</p>
                    )}
                  </div>
                </div>
              )}

              {corporativo && fecha && (
                <div className="mt-6 flex justify-end border-t border-dashed border-border pt-5">
                  <Button
                    type="button"
                    onClick={() => {
                      setPasoUnoAbierto(false);
                      setPasoDosHabilitado(true);
                    }}
                  >
                    Seguir con {variosDias ? 'cada día' : 'tu evento'}
                  </Button>
                </div>
              )}
            </Paso>
          )}

          {corporativo && pasoDosHabilitado && (
            <Paso numero={2} titulo={variosDias ? 'Armá cada día' : 'Armá tu evento'}>
              {!variosDias ? (
                editorDelDia
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-dorado/15 px-4 py-3 text-sm text-foreground/80">
                    <span className="font-semibold">
                      {diasListos} de {cantidadDeDias} días {diasListos === 1 ? 'listo' : 'listos'}
                    </span>
                    <span
                      className="flex h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-border"
                      aria-hidden
                    >
                      <span
                        className="bg-estado-confirmado"
                        style={{ width: `${(diasListos / cantidadDeDias) * 100}%` }}
                      />
                      <span
                        className="bg-dorado"
                        style={{ width: `${(diasEmpezados / cantidadDeDias) * 100}%` }}
                      />
                    </span>
                  </div>

                  {bloques.map((bloque) => {
                    const i = bloque.indice;
                    const abierta = i === activo && diaAbierto !== null;
                    const siguiente = siguienteIncompleto(i);
                    return (
                      <div key={bloque.fecha ?? i} id={`dia-${i}`} className="scroll-mt-24">
                        <TarjetaDia
                          numero={i + 1}
                          fecha={bloque.fecha!}
                          estado={
                            abierta
                              ? 'abierta'
                              : bloque.completo
                                ? 'completa'
                                : bloque.empezado
                                  ? 'incompleta'
                                  : 'sinCargar'
                          }
                          resumen={resumenDelDia(bloque.dia)}
                          subtotal={bloque.subtotal}
                          error={mensajeDeErrores(erroresDeDias[i])}
                          copiar={
                            <CopiarDiaCargado
                              opciones={opcionesDeCopia(i)}
                              onCopiar={(desde) => copiarDia(desde, i)}
                            />
                          }
                          textoListo={
                            siguiente !== null
                              ? `Listo · seguir con el día ${siguiente + 1}`
                              : 'Listo'
                          }
                          onAbrir={() => irAlDia(i)}
                          onListo={() => terminarDia(i)}
                        >
                          {abierta && editorDelDia}
                        </TarjetaDia>
                      </div>
                    );
                  })}
                </div>
              )}
            </Paso>
          )}
        </div>

        {/* Resumen en vivo */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {tipo === 'Social' ? (
            <ResumenConsultaSocial
              fecha={fecha}
              fechaFin={fechaFin}
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
            <>
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
                    {variosDias && bloques.some((b) => tieneHorario(b.dia)) && (
                      <>
                        {' · '}
                        {
                          resumenDeJornada(
                            bloques.filter((b) => tieneHorario(b.dia)).map((b) => jornadaDe(b.dia)),
                          ).texto
                        }
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
                                {tieneHorario(bloque.dia) &&
                                  ` · ${bloque.dia.horaDesde} a ${bloque.dia.horaHasta}`}
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
                                  <span className="shrink-0 font-medium tabular-nums">
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
                      Validez de {DIAS_VIGENCIA_PRESUPUESTO} días. Para reservar se abona
                      {variosDias ? ' una sola seña' : ' una seña'} del {PORCENTAJE_SENA}% dentro de
                      ese plazo, calculada sobre el total con IVA.
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
                    disabled={
                      solicitar.isPending ||
                      !perfil.data ||
                      (corporativo && !pasoDosHabilitado) ||
                      primerDiaIncompleto >= 0
                    }
                    onClick={generar}
                    hidden={!tipo}
                  >
                    {solicitar.isPending
                      ? 'Generando…'
                      : primerDiaIncompleto >= 0
                        ? `Completá el día ${primerDiaIncompleto + 1} para enviar`
                        : 'Generar presupuesto'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

// Resumen lateral de la consulta social (ADR 0008): lo que el cliente contó, sin precios.
function ResumenConsultaSocial({
  fecha,
  fechaFin,
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
  // HU-50: el último día, si la consulta es de varios.
  fechaFin: string;
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
    fecha && fechaFin && fechaFin !== fecha
      ? [
          'Fechas',
          `${fecha.split('-').reverse().join('/')} al ${fechaFin.split('-').reverse().join('/')} · ${textoDeDias(fecha, fechaFin)}`,
        ]
      : ['Fecha', fecha ? fecha.split('-').reverse().join('/') : 'Sin fecha'],
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
