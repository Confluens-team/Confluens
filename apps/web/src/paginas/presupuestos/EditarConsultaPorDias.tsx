import {
  aplicarModalidad,
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  ETIQUETAS_TIPO_EVENTO_SOCIAL,
  fechasDeLaFranja,
  hoyEnZonaEventos,
  MAXIMO_PERSONAS_EVENTO,
  MODALIDADES_SERVICIO,
  mesesHastaEvento,
  proyectarPrecio,
  sumarDias,
  type ConsultaDetallada,
  type ModalidadServicio,
  type SalonConDistribuciones,
  type Servicio,
  type TipoEvento,
  type TipoEventoSocial,
  type TipoJornada,
} from '@confluens/shared';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import { CintaDeDias, type DiaDeLaCinta } from '@/components/CintaDeDias';
import { AvisosDeLosDias, DatoDelDia, EncabezadoDelDia } from '@/components/PanelDelDia';
import { TarjetaCliente } from '@/components/TarjetaCliente';
import { InputEntero } from '@/components/InputEntero';
import { InputImporte } from '@/components/InputImporte';
import { SelectorHora, SelectorRangoFechas } from '@/components/SelectorFechaHora';
import { SelectorModalidad } from '@/components/SelectorModalidad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgendarEvento, useEvento } from '@/hooks/use-eventos';
import {
  useChoquesDeConsulta,
  useDarDeBajaConsulta,
  useModificarConsulta,
} from '@/hooks/use-presupuestos';
import { ErrorApiCliente } from '@/lib/api';
import { agruparPorCategoria } from '@/lib/catalogo';
import { nombreDeJornada } from '@/lib/dias-del-evento';
import { formatearFechaNumerica, formatearPesos, nombreCompleto } from '@/lib/formato';
import {
  type DiaParaAgendar,
  diaListoParaAgendar,
  horaGuardada,
  pedidoDeAgenda,
  superaCapacidad,
} from '@/lib/horario-del-dia';
import { jornadaDeHoras, textoHorarioEstimado } from '@/lib/jornada';
import {
  avisosDeLosDias,
  choquesPorFecha,
  estadoDeDiaDeConsulta,
  resumenDelDia,
} from '@/lib/cinta-de-dias';
import { cn } from '@/lib/utils';
import { ObservacionesDelEvento } from '@/paginas/eventos/ObservacionesDelEvento';
import { type CambioDePrecio, cambiosDePrecio, preciosParaFecha } from './recalculo-por-fecha';
import { ComentariosDelCliente } from './ComentariosDelCliente';
import { EncabezadoDeConsulta, type PestaniaDeConsulta } from './EncabezadoDeConsulta';
import { SeguimientoConsulta } from './SeguimientoConsulta';
import { DisposicionConPagos } from '@/paginas/eventos/DisposicionConPagos';
import { HistorialDelRegistro } from '@/paginas/auditoria/HistorialDelRegistro';

// HU-50, parte 2: la consulta de un evento de varios días, editada día por día. El personal arma acá
// el detalle de cada día (personas, jornada, salones, servicios y adicionales) y, con una consulta
// social, es donde se completa lo que el cliente dejó vacío. Cada día se identifica por su fecha:
// cambiar la franja extiende o achica sus extremos, y un día nuevo entra vacío o copiando el anterior.
//
// Desde el 15/11/2026 es la pantalla de toda consulta, también la de un solo día (con un día no se
// ve la cinta). Cada día lleva además su horario y la distribución de cada salón: la jornada sale del
// horario, como en el cotizador del cliente, y al guardar con todo completo se agenda el evento.

interface LineaEditable {
  clave: string;
  servicioId: number | null;
  descripcion: string;
  cantidad: string;
  hora: string;
  // En un servicio del catálogo es el precio base, sin el recargo de la modalidad (RN-11).
  precio: string;
  tercerizado: boolean;
  modalidad: ModalidadServicio;
  admiteModalidad: boolean;
}

interface SalonEditable {
  salonId: number;
  precio: string;
}

// Lo de un día mientras se edita. La fecha no está acá: es la de su posición en la franja.
interface DiaEditable {
  personas: string;
  // Sale del horario cuando están las dos horas; sin horario queda la guardada (pone el precio del
  // salón).
  jornada: TipoJornada;
  // "HH:mm" o '': lo agendado o, si no, lo que pidió el cliente para ese día (S-16).
  inicio: string;
  fin: string;
  salonesSel: SalonEditable[];
  // La distribución de cada salón del día: id del salón → id de la distribución ('' sin elegir).
  distribuciones: Record<number, string>;
  lineas: LineaEditable[];
}

const OTRO = 'otro';
const esEntero = (valor: string) => /^\d+$/.test(valor) && Number(valor) > 0;
const esImporte = (valor: string) => /^\d{1,10}(\.\d{1,2})?$/.test(valor);
const subtotal = (cantidad: string, precio: string) =>
  esEntero(cantidad) && esImporte(precio) ? Number(cantidad) * Number(precio) : 0;
const precioConRecargo = (linea: LineaEditable) =>
  esImporte(linea.precio) ? aplicarModalidad(linea.precio, linea.modalidad) : linea.precio;
const subtotalDeLinea = (linea: LineaEditable) => subtotal(linea.cantidad, precioConRecargo(linea));
const aCotizar = (linea: LineaEditable) =>
  linea.precio === '' && linea.servicioId !== null && linea.tercerizado;
const precioValido = (linea: LineaEditable) => esImporte(linea.precio) || aCotizar(linea);
const mensajeDeError = (error: unknown, porDefecto: string) =>
  error instanceof ErrorApiCliente ? error.message : porDefecto;

const claseSelect = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm';
const claseCambiado = 'bg-amber-50 ring-2 ring-amber-400';
const TIPOS_SOCIALES = Object.entries(ETIQUETAS_TIPO_EVENTO_SOCIAL) as [TipoEventoSocial, string][];

const diaVacio = (): DiaEditable => ({
  personas: '',
  jornada: 'completa',
  inicio: '',
  fin: '',
  salonesSel: [],
  distribuciones: {},
  lineas: [],
});

const copiaDeDia = (dia: DiaEditable): DiaEditable => ({
  ...dia,
  salonesSel: dia.salonesSel.map((s) => ({ ...s })),
  distribuciones: { ...dia.distribuciones },
  // Cada línea copiada es una nueva: su clave no puede repetir la del día de origen.
  lineas: dia.lineas.map((l, i) => ({ ...l, clave: `copia-${Date.now()}-${i}` })),
});

// El horario de un día al abrir la consulta: lo agendado o, si no, lo que pidió el cliente (el del día,
// S-16, o el de todo el evento). Solo se precarga si pidió las dos horas: con una sola el horario
// quedaría a medias y no se podría guardar; esa se muestra aparte (`horarioPedido`).
function horasIniciales(
  consulta: ConsultaDetallada,
  dia: ConsultaDetallada['dias'][number],
): { inicio: string; fin: string } {
  if (dia.inicio && dia.fin)
    return { inicio: horaGuardada(dia.inicio), fin: horaGuardada(dia.fin) };
  const pedido = horarioPedido(consulta, dia);
  return pedido.inicio && pedido.fin ? pedido : { inicio: '', fin: '' };
}

function horarioPedido(
  consulta: ConsultaDetallada,
  dia: ConsultaDetallada['dias'][number] | undefined,
): { inicio: string; fin: string } {
  if (dia?.horaInicioEstimada) {
    return { inicio: dia.horaInicioEstimada, fin: dia.horaFinEstimada ?? '' };
  }
  return {
    inicio: consulta.evento.horaInicioEstimada ?? '',
    fin: consulta.evento.horaFinEstimada ?? '',
  };
}

// El día de la consulta guardada con esa fecha, armado para editar. Sin día guardado (un día nuevo
// de la franja), entra vacío.
function diaEditableDe(consulta: ConsultaDetallada, fecha: string): DiaEditable {
  const dia = consulta.dias.find((d) => d.fecha === fecha);
  if (!dia) return diaVacio();
  const delDia = consulta.lineas.filter((l) => l.diaId === dia.id);
  return {
    personas: String(dia.cantidadPersonas),
    jornada: dia.tipoJornada ?? consulta.tipoJornada,
    ...horasIniciales(consulta, dia),
    distribuciones: Object.fromEntries(
      dia.salones.flatMap((salon) =>
        salon.distribucion ? [[salon.id, String(salon.distribucion.id)]] : [],
      ),
    ),
    salonesSel: delDia
      .filter((l) => l.tipo === 'salon' && l.salonId !== null)
      .map((l) => ({ salonId: l.salonId!, precio: l.precioUnitario })),
    lineas: delDia
      .filter((l) => l.tipo !== 'salon')
      .map((l) => ({
        clave: `linea-${l.id}`,
        servicioId: l.servicioId,
        descripcion: l.descripcion,
        cantidad: String(l.cantidad),
        hora: l.horaEstimada ?? '',
        precio: l.aCotizar ? '' : (l.precioBase ?? l.precioUnitario),
        tercerizado: l.tercerizado,
        modalidad: l.modalidad,
        admiteModalidad: l.admiteModalidad,
      })),
  };
}

export function EditarConsultaPorDias({
  consulta,
  salones,
  catalogo,
  porcentajeMensual,
  onGuardada,
  onDadaDeBaja,
  onDescargarPresupuesto,
  onImprimirComanda,
  textoVolverAlGuardar,
  pestania,
  pestanias,
}: {
  consulta: ConsultaDetallada;
  salones: SalonConDistribuciones[];
  catalogo: Servicio[];
  porcentajeMensual: string;
  onGuardada: (consulta: ConsultaDetallada) => void;
  onDadaDeBaja: (consulta: ConsultaDetallada) => void;
  onDescargarPresupuesto: () => void;
  // Comanda de cocina del evento confirmado. Sin esto el botón no aparece.
  onImprimirComanda?: (presupuestoId: number) => void;
  textoVolverAlGuardar: string;
  // 15/11/2026: la pestaña elegida y las pestañas, que van arriba a la derecha del título.
  pestania: PestaniaDeConsulta;
  pestanias: React.ReactNode;
}) {
  const modificar = useModificarConsulta(consulta.id);
  const darDeBaja = useDarDeBajaConsulta(consulta.id);
  // Al guardar con el horario y la distribución de todos los días, se agenda el evento.
  const agendar = useAgendarEvento(consulta.evento.id);
  // El evento, para las observaciones de cada día (son del evento, no del presupuesto).
  const evento = useEvento(consulta.evento.id);
  const choques = useChoquesDeConsulta(
    consulta.estado === 'Estimado' || consulta.estado === 'Expirado' ? consulta.id : undefined,
  );

  const [guardada, setGuardada] = useState<ConsultaDetallada | null>(null);
  const refAviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (guardada) refAviso.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [guardada]);

  // La consulta como está guardada: contra ella se comparan la franja y los precios (HU-54).
  const [guardado, setGuardado] = useState(consulta);
  const [inicio, setInicio] = useState(consulta.evento.fecha);
  const [fin, setFin] = useState(consulta.evento.fechaFin);
  const fechas = fechasDeLaFranja(inicio, fin);
  const [dias, setDias] = useState<DiaEditable[]>(() =>
    fechasDeLaFranja(inicio, fin).map((fecha) => diaEditableDe(consulta, fecha)),
  );
  const [activo, setActivo] = useState(0);
  const [tipo, setTipo] = useState<TipoEvento>(consulta.evento.tipo);
  const [tipoSocial, setTipoSocial] = useState<TipoEventoSocial | ''>(
    consulta.evento.tipoSocial ?? '',
  );
  const [detalleOtro, setDetalleOtro] = useState(consulta.evento.tipoSocialDetalle ?? '');
  const [agregar, setAgregar] = useState('');
  const [otro, setOtro] = useState({ descripcion: '', cantidad: '1', precio: '' });
  const [confirmandoPrecios, setConfirmandoPrecios] = useState(false);
  const [guardadaConPreciosNuevos, setGuardadaConPreciosNuevos] = useState(false);

  const enCurso =
    (consulta.estado === 'Estimado' || consulta.estado === 'Expirado') &&
    consulta.evento.estado === 'EnConsulta';
  const expirado = consulta.estado === 'Expirado';
  // RN-09: el Responsable de Eventos modifica en todo momento, también un evento ya reservado. Sigue
  // Confirmado y sin baja desde acá (se cancela desde el evento, RN-07).
  const confirmado =
    consulta.estado === 'Confirmado' &&
    (consulta.evento.estado === 'Reservado' || consulta.evento.estado === 'Cobrado');
  const editable = enCurso || confirmado;
  // Un presupuesto de más: el evento ya está confirmado con otro. Solo se puede dar de baja.
  const sobrante =
    (consulta.estado === 'Estimado' || consulta.estado === 'Expirado') &&
    (consulta.evento.estado === 'Reservado' || consulta.evento.estado === 'Cobrado');
  const salonDe = (salonId: number) => salones.find((s) => s.id === salonId);

  const indice = Math.min(activo, Math.max(dias.length - 1, 0));
  const dia = dias[indice] ?? diaVacio();
  // Lo que pidió el cliente para el día elegido, para mostrarlo si no se precargó.
  const pedidoDelDia = horarioPedido(
    consulta,
    consulta.dias.find((d) => d.fecha === fechas[indice]),
  );

  function cambiarDia(
    cambio: Partial<DiaEditable> | ((anterior: DiaEditable) => Partial<DiaEditable>),
  ) {
    setDias((anteriores) =>
      anteriores.map((d, i) =>
        i === indice ? { ...d, ...(typeof cambio === 'function' ? cambio(d) : cambio) } : d,
      ),
    );
  }

  // RN-13: con varios días, los precios se proyectan al ÚLTIMO día de la franja (PO, 12/11/2026).
  const referencia = fechas[fechas.length - 1] ?? fin;
  const proyectarA = (precio: string, fechaDeReferencia: string) =>
    proyectarPrecio(
      precio,
      porcentajeMensual,
      mesesHastaEvento(hoyEnZonaEventos(), fechaDeReferencia),
    );
  const precioDeSalon = (salon: SalonConDistribuciones, jornada: TipoJornada) =>
    jornada === 'completa' ? salon.precioJornadaCompleta : salon.precioMediaJornada;
  const precioVigente = (servicio: Servicio) =>
    servicio.precio === null || servicio.tercerizado
      ? servicio.precio
      : proyectarA(servicio.precio, referencia);

  // Lo guardado de cada día, por su fecha: a eso vuelven los precios si se vuelve a la referencia
  // original, y contra eso se muestra qué cambió.
  const originalesDelDia = (fecha: string) => {
    const guardadoDelDia = guardado.dias.find((d) => d.fecha === fecha);
    const lineasGuardadas = guardado.lineas.filter((l) => l.diaId === guardadoDelDia?.id);
    return {
      jornada: guardadoDelDia?.tipoJornada ?? guardado.tipoJornada,
      salon: new Map(
        lineasGuardadas
          .filter((l) => l.tipo === 'salon' && l.salonId !== null)
          .map((l) => [l.salonId!, l.precioUnitario]),
      ),
      linea: new Map(
        lineasGuardadas
          .filter((l) => l.tipo !== 'salon' && !l.aCotizar)
          .map((l) => [`linea-${l.id}`, l.precioBase ?? l.precioUnitario]),
      ),
    };
  };

  // Un día con los precios de la referencia nueva (HU-54): el salón y los servicios propios toman el
  // vigente proyectado; si se vuelve a la referencia original, cada línea recupera lo guardado.
  function conPreciosPara(d: DiaEditable, fecha: string, nuevaReferencia: string): DiaEditable {
    const originales = originalesDelDia(fecha);
    const recalculado = preciosParaFecha(nuevaReferencia, d.salonesSel, d.lineas, {
      originalesSalon: originales.salon,
      originalesLinea: originales.linea,
      fechaOriginal: guardado.evento.fechaFin,
      jornadaOriginalCoincide: d.jornada === originales.jornada,
      precioSalonCatalogo: (salonId) => {
        const salon = salonDe(salonId);
        return salon ? precioDeSalon(salon, d.jornada) : null;
      },
      precioServicioCatalogo: (servicioId) =>
        catalogo.find((s) => s.id === servicioId)?.precio ?? null,
      proyectar: proyectarA,
    });
    return { ...d, salonesSel: recalculado.salones, lineas: recalculado.lineas };
  }

  // Cambiar la franja (HU-50): si se corrió entera, cada día conserva su lugar; si se estiró o se
  // achicó en un extremo, cada día se queda con su fecha, los que salen se pierden y los nuevos entran
  // vacíos. Si cambió el último día, todos los precios se recalculan con el de la fecha nueva.
  function cambiarFranja(nuevoInicio: string, nuevoFin: string) {
    const nuevas = fechasDeLaFranja(nuevoInicio, nuevoFin);
    if (nuevas.length === 0) return;
    const corrimiento =
      nuevas.length === fechas.length && nuevas[0] !== fechas[0]
        ? new Date(nuevas[0]!).getTime() - new Date(fechas[0]!).getTime()
        : null;
    const corrida =
      corrimiento !== null &&
      nuevas[nuevas.length - 1] === sumarDias(fechas[fechas.length - 1]!, corrimiento / 86_400_000);
    const porFecha = new Map(fechas.map((f, i) => [f, dias[i]!]));
    const siguientes = nuevas.map((f, i) => (corrida ? dias[i]! : (porFecha.get(f) ?? diaVacio())));
    const nuevaReferencia = nuevas[nuevas.length - 1]!;
    const recalcular = nuevaReferencia !== referencia;
    setInicio(nuevoInicio);
    setFin(nuevoFin);
    setDias(
      recalcular
        ? siguientes.map((d, i) => conPreciosPara(d, nuevas[i]!, nuevaReferencia))
        : siguientes,
    );
    setActivo((anterior) => Math.min(anterior, nuevas.length - 1));
  }

  function copiarDiaAnterior() {
    if (indice === 0) return;
    setDias((anteriores) =>
      anteriores.map((d, i) => (i === indice ? copiaDeDia(anteriores[i - 1]!) : d)),
    );
  }

  function alternarSalon(salonId: number) {
    cambiarDia((d) => {
      const salon = salonDe(salonId);
      const yaEsta = d.salonesSel.some((s) => s.salonId === salonId);
      const precio = salon ? proyectarA(precioDeSalon(salon, d.jornada), referencia) : '0.00';
      // Un salón con una sola distribución activa ya entra con ella.
      const activas = salon?.distribuciones.filter((distribucion) => distribucion.activo) ?? [];
      const distribuciones = { ...d.distribuciones };
      if (yaEsta) delete distribuciones[salonId];
      else if (activas.length === 1) distribuciones[salonId] = String(activas[0]!.id);
      return {
        salonesSel: yaEsta
          ? d.salonesSel.filter((s) => s.salonId !== salonId)
          : [...d.salonesSel, { salonId, precio }],
        distribuciones,
      };
    });
  }

  // La jornada sale del horario, como en el cotizador del cliente: hasta 4 horas es media jornada y
  // más es completa. Si cambia, cambia el precio de todos los salones de ese día.
  function cambiarHorario(campo: 'inicio' | 'fin', valor: string) {
    cambiarDia((d) => {
      const siguiente = { ...d, [campo]: valor };
      const jornada =
        siguiente.inicio && siguiente.fin
          ? jornadaDeHoras(siguiente.inicio, siguiente.fin)
          : d.jornada;
      if (jornada === d.jornada) return { [campo]: valor };
      return {
        [campo]: valor,
        jornada,
        salonesSel: d.salonesSel.map((s) => {
          const salon = salonDe(s.salonId);
          return salon
            ? { ...s, precio: proyectarA(precioDeSalon(salon, jornada), referencia) }
            : s;
        }),
      };
    });
  }

  function elegirDistribucion(salonId: number, distribucionId: string) {
    cambiarDia((d) => ({ distribuciones: { ...d.distribuciones, [salonId]: distribucionId } }));
  }

  // El día como lo pide agendar: cada salón con su distribución y la capacidad de esa distribución.
  const paraAgendar = (d: DiaEditable, fecha: string): DiaParaAgendar => ({
    fecha,
    inicio: d.inicio,
    fin: d.fin,
    personas: Number(d.personas) || 0,
    salones: d.salonesSel.map(({ salonId }) => {
      const distribucionId = d.distribuciones[salonId] ?? '';
      const distribucion = salonDe(salonId)?.distribuciones.find(
        (opcion) => String(opcion.id) === distribucionId,
      );
      return { salonId, distribucionId, capacidad: distribucion?.capacidad ?? null };
    }),
  });

  function actualizarLinea(clave: string, cambios: Partial<LineaEditable>) {
    cambiarDia((d) => ({
      lineas: d.lineas.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)),
    }));
  }

  const modalidadesLibres = (servicioId: number) =>
    MODALIDADES_SERVICIO.filter(
      (modalidad) =>
        !dia.lineas.some((l) => l.servicioId === servicioId && l.modalidad === modalidad),
    );
  const disponibles = catalogo.filter(
    (s) =>
      s.activo &&
      (!dia.lineas.some((l) => l.servicioId === s.id) ||
        (s.admiteModalidad && modalidadesLibres(s.id).length > 0)),
  );
  const otroValido =
    otro.descripcion.trim().length > 0 && esEntero(otro.cantidad) && esImporte(otro.precio);
  const puedeAgregar = agregar === OTRO ? otroValido : !!agregar;

  function agregarLinea() {
    if (agregar === OTRO) {
      cambiarDia((d) => ({
        lineas: [
          ...d.lineas,
          {
            clave: `otro-${Date.now()}`,
            servicioId: null,
            descripcion: otro.descripcion.trim(),
            cantidad: otro.cantidad,
            hora: '',
            precio: otro.precio,
            tercerizado: false,
            modalidad: 'Normal',
            admiteModalidad: false,
          },
        ],
      }));
      setOtro({ descripcion: '', cantidad: '1', precio: '' });
    } else {
      const servicio = catalogo.find((s) => s.id === Number(agregar));
      if (!servicio) return;
      cambiarDia((d) => ({
        lineas: [
          ...d.lineas,
          {
            clave: `servicio-${servicio.id}-${Date.now()}`,
            servicioId: servicio.id,
            descripcion: servicio.nombre,
            cantidad: servicio.porPersona && esEntero(d.personas) ? d.personas : '1',
            hora: '',
            precio: precioVigente(servicio) ?? '',
            tercerizado: servicio.tercerizado,
            modalidad: modalidadesLibres(servicio.id)[0] ?? 'Normal',
            admiteModalidad: servicio.admiteModalidad,
          },
        ],
      }));
    }
    setAgregar('');
  }

  // RN-04: un servicio por persona no puede superar a los asistentes de SU día.
  const topeDeLinea = (d: DiaEditable, servicioId: number | null) =>
    servicioId !== null && catalogo.find((s) => s.id === servicioId)?.porPersona
      ? Number(d.personas) || undefined
      : undefined;
  const cantidadPosible = (d: DiaEditable, linea: LineaEditable) => {
    const tope = topeDeLinea(d, linea.servicioId);
    return tope === undefined || Number(linea.cantidad) <= tope;
  };
  const repetida = (d: DiaEditable, linea: LineaEditable) =>
    linea.servicioId !== null &&
    d.lineas.some(
      (otra) =>
        otra.clave !== linea.clave &&
        otra.servicioId === linea.servicioId &&
        otra.modalidad === linea.modalidad,
    );

  const tipoValido =
    tipo === 'Corporativo' || (!!tipoSocial && (tipoSocial !== 'Otro' || !!detalleOtro.trim()));
  // El horario es opcional mientras es una consulta, pero va completo: las dos horas, distintas.
  const horarioValido = (d: DiaEditable) =>
    !d.inicio === !d.fin && (!d.inicio || d.inicio !== d.fin);
  // Un día está completo cuando se puede guardar: personas, salón (en un corporativo) y líneas válidas.
  const diaValido = (d: DiaEditable) =>
    esEntero(d.personas) &&
    horarioValido(d) &&
    (tipo !== 'Corporativo' || d.salonesSel.length > 0) &&
    d.salonesSel.every((s) => esImporte(s.precio)) &&
    d.lineas.every(
      (l) =>
        esEntero(l.cantidad) &&
        cantidadPosible(d, l) &&
        !repetida(d, l) &&
        precioValido(l) &&
        l.descripcion.trim(),
    );
  const valido = fechas.length > 0 && tipoValido && dias.every(diaValido);

  const subtotalDelDia = (d: DiaEditable) =>
    d.salonesSel.reduce((suma, s) => suma + (esImporte(s.precio) ? Number(s.precio) : 0), 0) +
    d.lineas.reduce((suma, l) => suma + subtotalDeLinea(l), 0);
  const importes = desglosarIva(dias.reduce((suma, d) => suma + subtotalDelDia(d), 0));
  const totalGuardado = desglosarIva(guardado.total).total;
  const cantidadACotizar = dias.reduce((suma, d) => suma + d.lineas.filter(aCotizar).length, 0);
  const quedaSinArmar = dias.every((d) => d.salonesSel.length === 0 && d.lineas.length === 0);

  // HU-54: si cambió el último día, se avisa qué precios cambiaron y se pide confirmarlo al guardar.
  const referenciaCambiada = !!referencia && referencia !== guardado.evento.fechaFin;
  const cambiosPorFecha: CambioDePrecio[] = referenciaCambiada
    ? dias.flatMap((d, i) => {
        const originales = originalesDelDia(fechas[i] ?? '');
        return cambiosDePrecio(
          d.salonesSel,
          d.lineas,
          originales.salon,
          originales.linea,
          (salonId) => salonDe(salonId)?.nombre ?? '',
        ).map((c) => ({
          ...c,
          clave: `dia-${i}-${c.clave}`,
          descripcion: `Día ${i + 1} · ${c.descripcion}`,
        }));
      })
    : [];

  function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    if (cambiosPorFecha.length > 0) {
      setConfirmandoPrecios(true);
      return;
    }
    enviar();
  }

  // Se mandan los precios que se ven: lo que se guarda es exactamente lo que está en pantalla.
  function enviar() {
    setConfirmandoPrecios(false);
    setGuardada(null);
    const conPreciosNuevos = cambiosPorFecha.length > 0;
    const aImporte = (valor: string) => Number(valor).toFixed(2);
    // Con el horario y la distribución de todos los días, se agenda después de guardar (agendar mira
    // los salones ya guardados). Solo si cambió algo respecto de lo agendado.
    agendar.reset();
    const pedido = pedidoDeAgenda(
      dias.map((d, i) => paraAgendar(d, fechas[i]!)),
      evento.data?.modalidadSalonRestaurante ?? false,
    );
    const horarioCambio = dias.some((d, i) => {
      const anterior = guardado.dias.find((g) => g.fecha === fechas[i]);
      if (!anterior) return true;
      return (
        d.inicio !== horaGuardada(anterior.inicio) ||
        d.fin !== horaGuardada(anterior.fin) ||
        d.salonesSel.some(
          ({ salonId }) =>
            (d.distribuciones[salonId] ?? '') !==
            String(anterior.salones.find((s) => s.id === salonId)?.distribucion?.id ?? ''),
        )
      );
    });
    modificar.mutate(
      {
        dias: dias.map((d, i) => ({
          fecha: fechas[i]!,
          cantidadPersonas: Number(d.personas),
          tipoJornada: d.jornada,
          salones: d.salonesSel.map((s) => ({
            salonId: s.salonId,
            precioUnitario: aImporte(s.precio),
          })),
          servicios: d.lineas
            .filter((l) => l.servicioId !== null)
            .map((l) => ({
              servicioId: l.servicioId!,
              cantidad: Number(l.cantidad),
              horaEstimada: l.hora || undefined,
              precioUnitario: aCotizar(l) ? undefined : aImporte(l.precio),
              modalidad: l.modalidad,
            })),
          adicionales: d.lineas
            .filter((l) => l.servicioId === null)
            .map((l) => ({
              descripcion: l.descripcion.trim(),
              cantidad: Number(l.cantidad),
              horaEstimada: l.hora || undefined,
              precioUnitario: aImporte(l.precio),
            })),
        })),
        salones: [],
        servicios: [],
        adicionales: [],
        tipo,
        tipoSocial: tipo === 'Social' && tipoSocial ? tipoSocial : null,
        tipoSocialDetalle: tipo === 'Social' && tipoSocial === 'Otro' ? detalleOtro.trim() : null,
      },
      {
        onSuccess: (resultado) => {
          // El formulario sigue abierto y pasa a comparar contra lo recién guardado, con las claves
          // de las líneas nuevas.
          setGuardado(resultado);
          setInicio(resultado.evento.fecha);
          setFin(resultado.evento.fechaFin);
          setDias(
            fechasDeLaFranja(resultado.evento.fecha, resultado.evento.fechaFin).map((f) =>
              diaEditableDe(resultado, f),
            ),
          );
          setGuardadaConPreciosNuevos(conPreciosNuevos);
          setGuardada(resultado);
          if (pedido && horarioCambio) agendar.mutate(pedido);
        },
      },
    );
  }

  function confirmarBaja() {
    const mensaje = sobrante
      ? `¿Dar de baja la consulta ${consulta.id}? Este presupuesto va a quedar como Cancelado. El ` +
        'evento sigue con su presupuesto confirmado y no cambia.'
      : `¿Dar de baja la consulta ${consulta.id}? El presupuesto y su evento van a quedar como ` +
        'Cancelado y no se van a poder modificar.';
    if (!window.confirm(mensaje)) return;
    darDeBaja.mutate(undefined, { onSuccess: onDadaDeBaja });
  }

  const capacidadElegida = dia.salonesSel.reduce(
    (suma, s) => suma + (salonDe(s.salonId)?.capacidadMaxima ?? 0),
    0,
  );
  const excedeCapacidad =
    dia.salonesSel.length > 0 && esEntero(dia.personas) && Number(dia.personas) > capacidadElegida;

  // La cinta de días: el estado de cada uno mientras se edita, con los choques de salón guardados
  // (RN-12; el aviso preventivo solo tiene sentido con la consulta en curso).
  const porFecha = choquesPorFecha(choques.data?.choques ?? []);
  const diasDeLaCinta: DiaDeLaCinta[] = fechas.map((fecha, i) => {
    const d = dias[i] ?? diaVacio();
    const estadoDelEditor = estadoDeDiaDeConsulta({
      salones: d.salonesSel.length,
      lineas: d.lineas.length,
      valido: diaValido(d),
      conflicto: porFecha.has(fecha),
    });
    // Un día que se puede guardar pero no agendar todavía: le falta el horario o una distribución.
    const faltaAgendar =
      estadoDelEditor === 'completo' &&
      d.salonesSel.length > 0 &&
      !diaListoParaAgendar(paraAgendar(d, fecha));
    return {
      fecha,
      resumen: resumenDelDia(
        d.salonesSel.map((s) => salonDe(s.salonId)?.nombre ?? ''),
        esEntero(d.personas) ? Number(d.personas) : null,
      ),
      estado: faltaAgendar ? 'pendiente' : estadoDelEditor,
      textoEstado: faltaAgendar
        ? !d.inicio
          ? 'Sin horario'
          : 'Sin distribución'
        : estadoDelEditor === 'pendiente'
          ? 'Falta completar'
          : undefined,
    };
  });
  const avisos = avisosDeLosDias(
    diasDeLaCinta,
    porFecha,
    'No tiene salón ni servicios: cargalos o copiá el día anterior.',
  );
  const diaGuardadoDelEvento = evento.data?.dias.find(
    (d) => d.fecha.slice(0, 10) === fechas[indice],
  );
  // Los datos del cliente, con WhatsApp y el PDF (cada uno con su check) y las acciones: quedan
  // fijos arriba en Detalle y en Pagos (15/11/2026).
  const tarjetaCliente = (
    <TarjetaCliente
      nombre={nombreCompleto(consulta.cliente)}
      correo={consulta.cliente.correo}
      telefono={consulta.cliente.telefono}
      etiqueta={consulta.cliente.etiqueta}
      nota="Los datos de contacto los mantiene el cliente desde su cuenta."
    >
      <SeguimientoConsulta consulta={consulta} onDescargar={onDescargarPresupuesto} />
      <div className="flex flex-wrap justify-end gap-2">
        {confirmado && onImprimirComanda && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onImprimirComanda(consulta.id)}
          >
            <Printer /> Comanda de cocina
          </Button>
        )}
        {/* Un evento confirmado no se da de baja desde acá: se cancela desde el evento (RN-07). */}
        {(enCurso || sobrante) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={darDeBaja.isPending}
            onClick={confirmarBaja}
          >
            <Trash2 /> Dar de baja
          </Button>
        )}
      </div>
    </TarjetaCliente>
  );
  return (
    <div className="space-y-6">
      <EncabezadoDeConsulta
        consulta={consulta}
        derecha={pestanias}
        extra={
          fechas.length > 1 && (
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              {fechas.length} días
            </span>
          )
        }
      />

      {pestania === 'historial' && <HistorialDelRegistro eventoId={consulta.evento.id} />}

      {/* Las pestañas cambian todo menos el título: el detalle se oculta, no se desmonta, para no
          perder lo que se estaba editando. */}
      <div className={pestania === 'historial' ? 'hidden' : undefined}>
        <DisposicionConPagos
          eventoId={consulta.evento.id}
          pagos={pestania === 'pagos'}
          cliente={tarjetaCliente}
        >
          <form onSubmit={guardar} className="space-y-6">
            {expirado && enCurso && (
              <p className="flex items-center gap-2 rounded-xl bg-estado-expirado-fondo px-4 py-3 text-sm font-medium text-estado-expirado-texto ring-1 ring-estado-expirado/30">
                <AlertTriangle className="size-4 shrink-0" />
                Presupuesto vencido. Si cambiás el último día de la franja, se recalcula con los
                precios de esa fecha.
              </p>
            )}
            {confirmado && (
              <p className="rounded-xl bg-estado-confirmado-fondo px-4 py-3 text-sm text-estado-confirmado-texto ring-1 ring-estado-confirmado-borde">
                Evento confirmado: podés modificar todo y sigue confirmado. Si cambiás la franja, el
                horario de cada día se corre con ella, y un día nuevo entra con el horario del día
                más cercano (se cambia después al agendar). Si algún día choca con otro evento, se
                avisan todos los choques y no se guarda nada. Si cambia el total, cambia el saldo a
                cobrar.
              </p>
            )}
            {sobrante && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                Este presupuesto quedó de más: el evento ya está confirmado con otro presupuesto.
                Podés darlo de baja sin tocar el evento.
              </p>
            )}
            {!editable && !sobrante && (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                {consulta.estado === 'Cancelado'
                  ? 'Esta consulta se dio de baja'
                  : 'El evento de esta consulta ya no está en consulta'}
                : se puede ver, pero no modificar.
              </p>
            )}

            <ComentariosDelCliente comentarios={consulta.evento.comentariosCliente} />

            <fieldset disabled={!editable} className="space-y-6">
              <section className="rounded-xl bg-card p-5 ring-1 ring-border">
                <h3 className="text-sm font-semibold">Evento</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label htmlFor="consulta-franja">Fechas</Label>
                    {/* Un clic es el primer día y otro el último: cambiar la franja suma o saca días en
                  sus extremos. No se puede sacar un día del medio. */}
                    <SelectorRangoFechas
                      id="consulta-franja"
                      inicio={inicio}
                      fin={fin}
                      onChange={cambiarFranja}
                      className={referenciaCambiada ? claseCambiado : undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="consulta-tipo">Tipo de evento</Label>
                    <select
                      id="consulta-tipo"
                      className={claseSelect}
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value as TipoEvento)}
                    >
                      <option value="Corporativo">Corporativo</option>
                      <option value="Social">Social</option>
                    </select>
                  </div>
                  {tipo === 'Social' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="consulta-tipo-social">¿Qué evento?</Label>
                      <select
                        id="consulta-tipo-social"
                        className={claseSelect}
                        value={tipoSocial}
                        aria-invalid={!tipoSocial}
                        onChange={(e) => setTipoSocial(e.target.value as TipoEventoSocial)}
                      >
                        <option value="" disabled>
                          Elegí…
                        </option>
                        {TIPOS_SOCIALES.map(([valor, etiqueta]) => (
                          <option key={valor} value={valor}>
                            {etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {tipo === 'Social' && tipoSocial === 'Otro' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="consulta-detalle-otro">Detalle</Label>
                      <Input
                        id="consulta-detalle-otro"
                        maxLength={120}
                        value={detalleOtro}
                        aria-invalid={!detalleOtro.trim()}
                        onChange={(e) => setDetalleOtro(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </section>
            </fieldset>

            {/* HU-50: la cinta con todos los días y su estado (docs/diseno/panel-evento-cinta-de-dias.md).
                Se elige un día y el panel de abajo, que queda fijo, muestra lo de ese día. */}
            {fechas.length > 1 && (
              <CintaDeDias dias={diasDeLaCinta} indice={indice} onElegir={setActivo} />
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
              <fieldset
                disabled={!editable}
                aria-label="Día elegido"
                className="min-w-0 rounded-xl bg-card p-5 ring-1 ring-border"
              >
                <EncabezadoDelDia
                  fecha={fechas[indice] ?? inicio}
                  indice={indice}
                  total={fechas.length}
                >
                  {indice > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={copiarDiaAnterior}>
                      <Copy /> Copiar el día anterior
                    </Button>
                  )}
                </EncabezadoDelDia>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <DatoDelDia
                    etiqueta={<Label htmlFor="dia-inicio">Hora de inicio</Label>}
                    ayuda={
                      !dia.inicio && pedidoDelDia.inicio
                        ? `Pidió ${textoHorarioEstimado(pedidoDelDia.inicio, pedidoDelDia.fin).replace(/^D/, 'd')}`
                        : undefined
                    }
                  >
                    <SelectorHora
                      id="dia-inicio"
                      className="bg-card font-normal"
                      value={dia.inicio}
                      onChange={(valor) => cambiarHorario('inicio', valor)}
                      opcional
                    />
                  </DatoDelDia>
                  <DatoDelDia
                    etiqueta={<Label htmlFor="dia-fin">Hora de fin</Label>}
                    ayuda={
                      dia.inicio && dia.fin && dia.fin < dia.inicio
                        ? 'Termina al día siguiente.'
                        : undefined
                    }
                  >
                    <SelectorHora
                      id="dia-fin"
                      className="bg-card font-normal"
                      value={dia.fin}
                      onChange={(valor) => cambiarHorario('fin', valor)}
                      horaSugerida={dia.inicio || undefined}
                      opcional
                      aria-invalid={!horarioValido(dia)}
                    />
                  </DatoDelDia>
                  <DatoDelDia etiqueta={<Label htmlFor="dia-personas">Personas</Label>}>
                    <InputEntero
                      id="dia-personas"
                      className="bg-card font-normal"
                      max={MAXIMO_PERSONAS_EVENTO}
                      value={dia.personas}
                      aria-invalid={!esEntero(dia.personas)}
                      onChangeValor={(personas) => cambiarDia({ personas })}
                    />
                  </DatoDelDia>
                  {/* La jornada no se elige: sale del horario, como en el cotizador del cliente. */}
                  <DatoDelDia
                    etiqueta="Jornada"
                    className={
                      dia.inicio && dia.fin
                        ? 'bg-dorado/15 text-dorado-texto ring-dorado/30'
                        : undefined
                    }
                    ayuda={
                      dia.inicio && dia.fin
                        ? dia.jornada === 'media'
                          ? 'Hasta 4 horas'
                          : 'Más de 4 horas'
                        : 'Se calcula con el horario'
                    }
                  >
                    <span aria-live="polite">{nombreDeJornada(dia.jornada)}</span>
                  </DatoDelDia>
                </div>
                {!horarioValido(dia) && (
                  <p className="mt-2 text-xs font-medium text-destructive">
                    {dia.inicio && dia.fin
                      ? 'La hora de fin tiene que ser distinta de la de inicio.'
                      : 'Completá la hora de inicio y la de fin, o dejá las dos vacías.'}
                  </p>
                )}

                <fieldset className="mt-4 space-y-2">
                  <legend className="font-semibold">Salones</legend>
                  <div className="flex flex-wrap gap-2">
                    {salones.map((s) => {
                      const elegido = dia.salonesSel.some((sel) => sel.salonId === s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-pressed={elegido}
                          onClick={() => alternarSalon(s.id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                            elegido
                              ? 'border-bordo bg-bordo text-crema'
                              : 'border-input hover:border-bordo/60',
                          )}
                        >
                          {elegido && <Check className="size-3.5" />}
                          {s.nombre}
                          <span className={elegido ? 'text-crema/75' : 'text-muted-foreground'}>
                            · hasta {s.capacidadMaxima}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* La distribución (el armado) de cada salón de este día: el mismo salón se puede
                      armar distinto un día y otro (ADR 0011). */}
                  {dia.salonesSel.length > 0 && (
                    <div className="grid gap-3 pt-2 sm:grid-cols-2">
                      {dia.salonesSel.map(({ salonId }) => {
                        const salon = salonDe(salonId);
                        const elegida = dia.distribuciones[salonId] ?? '';
                        // Las dadas de baja no se ofrecen, salvo la que el día ya tiene.
                        const opciones = (salon?.distribuciones ?? []).filter(
                          (opcion) => opcion.activo || String(opcion.id) === elegida,
                        );
                        return (
                          <div key={salonId} className="space-y-1.5">
                            <Label htmlFor={`distribucion-${salonId}`}>
                              Distribución
                              {dia.salonesSel.length > 1 && ` de ${salon?.nombre ?? ''}`}
                            </Label>
                            <select
                              id={`distribucion-${salonId}`}
                              className={claseSelect}
                              value={elegida}
                              onChange={(e) => elegirDistribucion(salonId, e.target.value)}
                            >
                              <option value="">Elegir…</option>
                              {opciones.map((opcion) => (
                                <option key={opcion.id} value={opcion.id}>
                                  {opcion.nombre} · hasta {opcion.capacidad} personas
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {superaCapacidad(paraAgendar(dia, fechas[indice] ?? inicio)) && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                      <AlertTriangle className="size-3.5" /> {dia.personas} personas superan lo que
                      admite la distribución. Es un aviso: se puede guardar igual.
                    </p>
                  )}
                  {tipo === 'Corporativo' && dia.salonesSel.length === 0 && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                      <AlertTriangle className="size-3.5" /> Un evento corporativo necesita al menos
                      un salón cada día.
                    </p>
                  )}
                  {excedeCapacidad && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                      <AlertTriangle className="size-3.5" /> {dia.personas} personas superan la
                      capacidad ({capacidadElegida}). Es un aviso: se puede guardar igual.
                    </p>
                  )}
                </fieldset>

                {cambiosPorFecha.length > 0 && (
                  <div
                    role="status"
                    className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-2 ring-amber-300"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <RefreshCw className="size-4 shrink-0" />
                      Precios recalculados: el último día pasó del{' '}
                      {formatearFechaNumerica(guardado.evento.fechaFin)} al{' '}
                      {formatearFechaNumerica(referencia)}
                    </p>
                    <p className="mt-1">
                      Todo el presupuesto se proyectó con el incremento del{' '}
                      {Number(porcentajeMensual)}% mensual a esa fecha, también los días que ya
                      estaban.
                    </p>
                    <ResumenCambios cambios={cambiosPorFecha} />
                    <p className="mt-2 text-xs">
                      Total antes {formatearPesos(totalGuardado)} · ahora{' '}
                      {formatearPesos(importes.total)}
                    </p>
                  </div>
                )}

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-medium">Concepto</th>
                        <th className="w-24 pb-2 font-medium">Cantidad</th>
                        <th className="w-28 pb-2 font-medium">Hora</th>
                        <th className="w-36 pb-2 font-medium">Precio unitario</th>
                        <th className="w-32 pb-2 text-right font-medium">Subtotal</th>
                        <th className="w-10 pb-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dia.salonesSel.length === 0 && dia.lineas.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-6 text-center text-sm text-muted-foreground"
                          >
                            Este día entra vacío: elegí el salón y agregá los servicios, o copiá el
                            día anterior.
                          </td>
                        </tr>
                      )}
                      {dia.salonesSel.map((sel) => {
                        const nombre = salonDe(sel.salonId)?.nombre ?? '';
                        return (
                          <tr key={`salon-${sel.salonId}`}>
                            <td className="py-2 pr-3">
                              Salón {nombre} (
                              {dia.jornada === 'completa' ? 'jornada completa' : 'media jornada'})
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">1</td>
                            <td className="py-2 pr-3 text-muted-foreground">—</td>
                            <td className="py-2 pr-3">
                              <InputImporte
                                aria-label={`Precio del salón ${nombre}`}
                                value={sel.precio}
                                aria-invalid={!esImporte(sel.precio)}
                                onChange={(e) =>
                                  cambiarDia((d) => ({
                                    salonesSel: d.salonesSel.map((s) =>
                                      s.salonId === sel.salonId
                                        ? { ...s, precio: e.target.value }
                                        : s,
                                    ),
                                  }))
                                }
                              />
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              {esImporte(sel.precio) ? formatearPesos(sel.precio) : '—'}
                            </td>
                            <td />
                          </tr>
                        );
                      })}
                      {dia.lineas.map((linea) => (
                        <tr key={linea.clave}>
                          <td className="py-2 pr-3">
                            {linea.servicioId === null ? (
                              <Input
                                aria-label="Descripción del adicional"
                                value={linea.descripcion}
                                aria-invalid={!linea.descripcion.trim()}
                                onChange={(e) =>
                                  actualizarLinea(linea.clave, { descripcion: e.target.value })
                                }
                              />
                            ) : (
                              <>
                                {linea.descripcion}
                                {linea.tercerizado && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    (tercerizado)
                                  </span>
                                )}
                                {(linea.admiteModalidad || linea.modalidad !== 'Normal') && (
                                  <SelectorModalidad
                                    id={`modalidad-${linea.clave}`}
                                    className="mt-1 block w-full"
                                    value={linea.modalidad}
                                    onChange={(modalidad) =>
                                      actualizarLinea(linea.clave, { modalidad })
                                    }
                                  />
                                )}
                                {repetida(dia, linea) && (
                                  <span className="mt-1 block text-xs text-destructive">
                                    Ya está con esta modalidad: elegí otra o quitá una de las dos.
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            <InputEntero
                              aria-label={`Cantidad de ${linea.descripcion}`}
                              max={topeDeLinea(dia, linea.servicioId)}
                              value={linea.cantidad}
                              aria-invalid={
                                !esEntero(linea.cantidad) || !cantidadPosible(dia, linea)
                              }
                              onChangeValor={(cantidad) =>
                                actualizarLinea(linea.clave, { cantidad })
                              }
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <SelectorHora
                              aria-label={`Hora de ${linea.descripcion} (opcional)`}
                              value={linea.hora}
                              onChange={(hora) => actualizarLinea(linea.clave, { hora })}
                              opcional
                              placeholder="--:--"
                              horaSugerida={dia.inicio || undefined}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <InputImporte
                              aria-label={`Precio unitario de ${linea.descripcion}`}
                              sinSigno={aCotizar(linea)}
                              value={linea.precio}
                              placeholder={linea.tercerizado ? 'A cotizar' : undefined}
                              aria-invalid={!precioValido(linea)}
                              onChange={(e) =>
                                actualizarLinea(linea.clave, { precio: e.target.value })
                              }
                            />
                            {linea.modalidad !== 'Normal' && esImporte(linea.precio) && (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                Con recargo: {formatearPesos(precioConRecargo(linea))}
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            {aCotizar(linea) ? (
                              <span className="text-xs font-medium text-amber-900">A cotizar</span>
                            ) : esEntero(linea.cantidad) && esImporte(linea.precio) ? (
                              formatearPesos(subtotalDeLinea(linea))
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Quitar ${linea.descripcion}`}
                              onClick={() =>
                                cambiarDia((d) => ({
                                  lineas: d.lineas.filter((l) => l.clave !== linea.clave),
                                }))
                              }
                            >
                              <X />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="pt-3 text-right text-xs text-muted-foreground">
                          Subtotal del día {indice + 1}
                        </td>
                        <td className="pt-3 text-right font-medium">
                          {formatearPesos(subtotalDelDia(dia))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-4 space-y-3 rounded-lg bg-muted/50 p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor="consulta-agregar">Agregar servicio al día {indice + 1}</Label>
                      <select
                        id="consulta-agregar"
                        className={cn(claseSelect, 'bg-card')}
                        value={agregar}
                        onChange={(e) => setAgregar(e.target.value)}
                      >
                        <option value="">Elegí un servicio…</option>
                        {agruparPorCategoria(disponibles).map(([categoria, delTipo]) => (
                          <optgroup key={categoria} label={categoria}>
                            {delTipo.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.nombre} ·{' '}
                                {s.precio === null ? 'a cotizar' : formatearPesos(s.precio)}
                                {s.porPersona ? ' por persona' : ''}
                                {s.tercerizado ? ' (tercerizado)' : ''}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <optgroup label="Otro">
                          <option value={OTRO}>Otro servicio (escribirlo a mano)</option>
                        </optgroup>
                      </select>
                    </div>
                    {agregar !== OTRO && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!puedeAgregar}
                        onClick={agregarLinea}
                      >
                        <Plus /> Agregar
                      </Button>
                    )}
                  </div>
                  {agregar === OTRO && (
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_9rem_auto] sm:items-end">
                      <div className="space-y-1.5">
                        <Label htmlFor="otro-descripcion">¿Qué servicio?</Label>
                        <Input
                          id="otro-descripcion"
                          className="bg-card"
                          placeholder="Por ejemplo: decoración con globos"
                          maxLength={120}
                          value={otro.descripcion}
                          onChange={(e) => setOtro({ ...otro, descripcion: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="otro-cantidad">Cantidad</Label>
                        <InputEntero
                          id="otro-cantidad"
                          className="bg-card"
                          value={otro.cantidad}
                          aria-invalid={!esEntero(otro.cantidad)}
                          onChangeValor={(cantidad) => setOtro({ ...otro, cantidad })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="otro-precio">Precio sin IVA</Label>
                        <InputImporte
                          id="otro-precio"
                          className="bg-card"
                          placeholder="0.00"
                          value={otro.precio}
                          onChange={(e) => setOtro({ ...otro, precio: e.target.value })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!puedeAgregar}
                        onClick={agregarLinea}
                      >
                        <Plus /> Agregar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Las observaciones internas son del día (HU-50): las de un día nuevo se cargan
                    después de guardarlo. */}
                {diaGuardadoDelEvento && (
                  <div className="mt-5 border-t pt-4 [--card-spacing:0px] [&>[data-slot]]:gap-2">
                    <ObservacionesDelEvento
                      key={diaGuardadoDelEvento.id}
                      evento={evento.data!}
                      dia={diaGuardadoDelEvento}
                      integrada
                    />
                  </div>
                )}
              </fieldset>

              <aside className="min-w-0 space-y-4">
                <section
                  aria-label="Total del evento"
                  className="rounded-xl bg-card p-5 ring-1 ring-border"
                >
                  <h3 className="font-heading text-base font-medium">Total del evento</h3>
                  <dl className="mt-3 space-y-1.5 text-sm">
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
                  {cantidadACotizar > 0 && (
                    <p className="mt-3 text-right text-xs text-amber-900">
                      {cantidadACotizar === 1
                        ? 'Un servicio está a cotizar y no suma al total.'
                        : `${cantidadACotizar} servicios están a cotizar y no suman al total.`}
                    </p>
                  )}
                  <p className="mt-3 text-right text-xs text-muted-foreground">
                    {quedaSinArmar
                      ? `La vigencia de ${DIAS_VIGENCIA_PRESUPUESTO} días empieza cuando guardes el presupuesto con el salón o algún servicio.`
                      : `Este presupuesto tiene una validez de ${DIAS_VIGENCIA_PRESUPUESTO} días.`}
                  </p>
                </section>
                <AvisosDeLosDias avisos={avisos} onVerDia={setActivo} />
              </aside>
            </div>

            {editable && (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {!valido && (
                    <p className="text-xs text-destructive">
                      {dias.some((d) => !diaValido(d))
                        ? `Falta completar: ${dias
                            .map((d, i) => (diaValido(d) ? null : `día ${i + 1}`))
                            .filter(Boolean)
                            .join(', ')}.`
                        : 'Revisá los datos del evento.'}
                    </p>
                  )}
                  <Button type="submit" disabled={!valido || modificar.isPending}>
                    {modificar.isPending ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </div>
              </div>
            )}
            {guardada && (
              <div
                ref={refAviso}
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200"
              >
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-4 shrink-0" /> Cambios guardados
                  {guardadaConPreciosNuevos && ', con los precios actualizados al último día'}.
                  ¿Querés{' '}
                  {textoVolverAlGuardar.charAt(0).toLowerCase() + textoVolverAlGuardar.slice(1)}?
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => onGuardada(guardada)}>
                    <ArrowLeft /> {textoVolverAlGuardar}
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Cerrar el aviso"
                    onClick={() => setGuardada(null)}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            )}
            {agendar.isError && (
              <p className="text-right text-sm whitespace-pre-line text-destructive">
                Se guardó el presupuesto, pero no el horario:{' '}
                {mensajeDeError(agendar.error, 'no se pudo agendar el evento.')}
              </p>
            )}
            {modificar.isError && (
              <p className="text-right text-sm whitespace-pre-line text-destructive">
                {mensajeDeError(modificar.error, 'No se pudieron guardar los cambios.')}
              </p>
            )}
            {darDeBaja.isError && (
              <p className="text-sm text-destructive">
                {mensajeDeError(darDeBaja.error, 'No se pudo dar de baja la consulta.')}
              </p>
            )}
          </form>
        </DisposicionConPagos>
      </div>

      <Dialog.Root open={confirmandoPrecios} onOpenChange={setConfirmandoPrecios}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-bordo">
              <RefreshCw className="size-5 text-amber-700" /> Cambiaron los precios
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Al pasar el último día del {formatearFechaNumerica(guardado.evento.fechaFin)} al{' '}
              {formatearFechaNumerica(referencia)} se recalcularon {cambiosPorFecha.length}{' '}
              {cambiosPorFecha.length === 1 ? 'precio' : 'precios'} con el incremento mensual. El
              presupuesto se va a guardar con estos precios.
            </Dialog.Description>
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
              <ResumenCambios cambios={cambiosPorFecha} />
              <p className="mt-2 text-xs">
                Total antes {formatearPesos(totalGuardado)} · ahora {formatearPesos(importes.total)}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmandoPrecios(false)}>
                Seguir editando
              </Button>
              <Button type="button" disabled={modificar.isPending} onClick={enviar}>
                Guardar con los precios nuevos
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// Cada precio que cambió con la franja: el guardado y el nuevo al lado.
function ResumenCambios({ cambios }: { cambios: CambioDePrecio[] }) {
  return (
    <ul className="mt-3 space-y-1">
      {cambios.map((cambio) => (
        <li key={cambio.clave} className="flex justify-between gap-4">
          <span>{cambio.descripcion}</span>
          <span className="whitespace-nowrap tabular-nums">
            <span className="text-muted-foreground line-through">
              {formatearPesos(cambio.antes)}
            </span>{' '}
            → <span className="font-medium">{formatearPesos(cambio.ahora)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
