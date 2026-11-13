import {
  aplicarModalidad,
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  ETIQUETAS_TIPO_EVENTO_SOCIAL,
  fechasDeLaFranja,
  hoyEnZonaEventos,
  MAXIMO_PERSONAS_EVENTO,
  MODALIDADES_SERVICIO,
  PORCENTAJE_SENA,
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
  CalendarCheck,
  CheckCircle2,
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { EtiquetaCliente } from '@/components/EtiquetaCliente';
import { IconoEstado } from '@/components/IconoEstado';
import { InputEntero } from '@/components/InputEntero';
import { InputImporte } from '@/components/InputImporte';
import { SelectorHora, SelectorRangoFechas } from '@/components/SelectorFechaHora';
import { SelectorModalidad } from '@/components/SelectorModalidad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDarDeBajaConsulta, useModificarConsulta } from '@/hooks/use-presupuestos';
import { ErrorApiCliente } from '@/lib/api';
import { agruparPorCategoria } from '@/lib/catalogo';
import { resumenDeJornada, textoDePersonas } from '@/lib/dias-del-evento';
import { formatearFechaNumerica, formatearPesos, nombreCompleto } from '@/lib/formato';
import { textoDeDias } from '@/lib/rango-de-fechas';
import { cn } from '@/lib/utils';
import { AvisoDeChoques } from './AvisoDeChoques';
import { type CambioDePrecio, cambiosDePrecio, preciosParaFecha } from './recalculo-por-fecha';
import { SeguimientoConsulta } from './SeguimientoConsulta';

// HU-50, parte 2: la consulta de un evento de varios días, editada día por día. El personal arma acá
// el detalle de cada día (personas, jornada, salones, servicios y adicionales) y, con una consulta
// social, es donde se completa lo que el cliente dejó vacío. Cada día se identifica por su fecha:
// cambiar la franja extiende o achica sus extremos, y un día nuevo entra vacío o copiando el anterior.
//
// Es el hermano de `EditarConsulta` para un solo día, que no cambia. Se usa cuando el evento ya dura
// varios días o cuando el personal estira la franja de uno de un día. Un evento de varios días solo
// se puede modificar mientras es una consulta: reservarlo y cobrarlo llegan en la próxima etapa.

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
  jornada: TipoJornada;
  salonesSel: SalonEditable[];
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
const fechaCorta = (fecha: Date) =>
  fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const claseSelect = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm';
const claseCambiado = 'bg-amber-50 ring-2 ring-amber-400';
const TIPOS_SOCIALES = Object.entries(ETIQUETAS_TIPO_EVENTO_SOCIAL) as [TipoEventoSocial, string][];
const ESTADOS: Record<string, string> = {
  Estimado: 'bg-estado-consulta-fondo text-estado-consulta-texto',
  Expirado: 'bg-estado-expirado-fondo text-estado-expirado-texto',
  Cancelado: 'bg-estado-cancelado-fondo text-estado-cancelado-texto',
  Confirmado: 'bg-estado-confirmado-fondo text-estado-confirmado-texto',
};

const formateadorSemana = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' });
// «lun 16/11»: para las pestañas y los títulos.
function nombreDeDia(fecha: string): string {
  const [, mes = '', dia = ''] = fecha.split('-');
  const semana = formateadorSemana.format(new Date(`${fecha}T00:00:00Z`)).replace('.', '');
  return `${semana} ${dia}/${mes}`;
}

const diaVacio = (): DiaEditable => ({
  personas: '',
  jornada: 'completa',
  salonesSel: [],
  lineas: [],
});

const copiaDeDia = (dia: DiaEditable): DiaEditable => ({
  ...dia,
  salonesSel: dia.salonesSel.map((s) => ({ ...s })),
  // Cada línea copiada es una nueva: su clave no puede repetir la del día de origen.
  lineas: dia.lineas.map((l, i) => ({ ...l, clave: `copia-${Date.now()}-${i}` })),
});

// El día de la consulta guardada con esa fecha, armado para editar. Sin día guardado (un día nuevo
// de la franja), entra vacío.
function diaEditableDe(consulta: ConsultaDetallada, fecha: string): DiaEditable {
  const dia = consulta.dias.find((d) => d.fecha === fecha);
  if (!dia) return diaVacio();
  const delDia = consulta.lineas.filter((l) => l.diaId === dia.id);
  return {
    personas: String(dia.cantidadPersonas),
    jornada: dia.tipoJornada ?? consulta.tipoJornada,
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
  franjaNueva,
  onGuardada,
  onDadaDeBaja,
  onAbrirEvento,
  onDescargarPresupuesto,
  textoVolverAlGuardar,
}: {
  consulta: ConsultaDetallada;
  salones: SalonConDistribuciones[];
  catalogo: Servicio[];
  porcentajeMensual: string;
  // Cuando el personal estira la franja de un evento de un solo día: arranca con esta franja.
  franjaNueva?: { inicio: string; fin: string };
  onGuardada: (consulta: ConsultaDetallada) => void;
  onDadaDeBaja: (consulta: ConsultaDetallada) => void;
  onAbrirEvento: (eventoId: number) => void;
  onDescargarPresupuesto: () => void;
  textoVolverAlGuardar: string;
}) {
  const modificar = useModificarConsulta(consulta.id);
  const darDeBaja = useDarDeBajaConsulta(consulta.id);

  const [guardada, setGuardada] = useState<ConsultaDetallada | null>(null);
  const refAviso = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (guardada) refAviso.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [guardada]);

  // La consulta como está guardada: contra ella se comparan la franja y los precios (HU-54).
  const [guardado, setGuardado] = useState(consulta);
  const [inicio, setInicio] = useState(franjaNueva?.inicio ?? consulta.evento.fecha);
  const [fin, setFin] = useState(franjaNueva?.fin ?? consulta.evento.fechaFin);
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
  const [horaEstimada, setHoraEstimada] = useState(consulta.evento.horaInicioEstimada ?? '');
  const [horaFinEstimada, setHoraFinEstimada] = useState(consulta.evento.horaFinEstimada ?? '');
  const [agregar, setAgregar] = useState('');
  const [otro, setOtro] = useState({ descripcion: '', cantidad: '1', precio: '' });
  const [confirmandoPrecios, setConfirmandoPrecios] = useState(false);
  const [guardadaConPreciosNuevos, setGuardadaConPreciosNuevos] = useState(false);

  const enCurso =
    (consulta.estado === 'Estimado' || consulta.estado === 'Expirado') &&
    consulta.evento.estado === 'EnConsulta';
  const expirado = consulta.estado === 'Expirado';
  const editable = enCurso;
  const salonDe = (salonId: number) => salones.find((s) => s.id === salonId);

  const indice = Math.min(activo, Math.max(dias.length - 1, 0));
  const dia = dias[indice] ?? diaVacio();

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
      return {
        salonesSel: yaEsta
          ? d.salonesSel.filter((s) => s.salonId !== salonId)
          : [...d.salonesSel, { salonId, precio }],
      };
    });
  }

  // Cambiar la jornada cambia el precio de todos los salones de ese día.
  function cambiarJornada(jornada: TipoJornada) {
    cambiarDia((d) => ({
      jornada,
      salonesSel: d.salonesSel.map((s) => {
        const salon = salonDe(s.salonId);
        return salon ? { ...s, precio: proyectarA(precioDeSalon(salon, jornada), referencia) } : s;
      }),
    }));
  }

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
  const horarioEstimadoValido =
    tipo !== 'Social' || !horaFinEstimada || (!!horaEstimada && horaFinEstimada !== horaEstimada);
  // Un día está completo cuando se puede guardar: personas, salón (en un corporativo) y líneas válidas.
  const diaValido = (d: DiaEditable) =>
    esEntero(d.personas) &&
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
  const valido = fechas.length > 0 && tipoValido && horarioEstimadoValido && dias.every(diaValido);

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
        horaInicioEstimada: horaEstimada || null,
        horaFinEstimada: tipo === 'Social' ? horaFinEstimada || null : null,
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
        },
      },
    );
  }

  function confirmarBaja() {
    const mensaje =
      `¿Dar de baja la consulta ${consulta.id}? El presupuesto y su evento van a quedar como ` +
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

  return (
    <form onSubmit={guardar} className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-bordo">Consulta {consulta.id}</h2>
          <p className="text-sm text-muted-foreground">
            Emitida el {fechaCorta(new Date(consulta.fechaEmision))} ·{' '}
            {consulta.venceEn
              ? `vence el ${fechaCorta(new Date(consulta.venceEn))}`
              : 'presupuesto sin armar'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeTipoEvento evento={consulta.evento} />
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold">
            {fechas.length} {fechas.length === 1 ? 'día' : 'días'}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
              ESTADOS[consulta.estado] ?? '',
            )}
          >
            <IconoEstado estado={consulta.estado} />
            {consulta.estado}
          </span>
        </div>
      </header>

      {expirado && enCurso && (
        <p className="flex items-center gap-2 rounded-xl bg-estado-expirado-fondo px-4 py-3 text-sm font-medium text-estado-expirado-texto ring-1 ring-estado-expirado/30">
          <AlertTriangle className="size-4 shrink-0" />
          Presupuesto vencido. Si cambiás el último día de la franja, se recalcula con los precios
          de esa fecha.
        </p>
      )}
      {!editable && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          {consulta.estado === 'Cancelado'
            ? 'Esta consulta se dio de baja'
            : 'El evento de esta consulta ya no está en consulta'}
          : se puede ver, pero no modificar.
        </p>
      )}

      <section className="rounded-xl bg-card p-5 ring-1 ring-border">
        <h3 className="text-sm font-semibold">Cliente</h3>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {nombreCompleto(consulta.cliente)}
              <EtiquetaCliente etiqueta={consulta.cliente.etiqueta} />
            </p>
            <p className="text-sm text-muted-foreground">
              {consulta.cliente.correo} · {consulta.cliente.telefono}
            </p>
          </div>
          <SeguimientoConsulta consulta={consulta} onDescargar={onDescargarPresupuesto} />
        </div>
      </section>

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
              <p className="text-xs text-muted-foreground">
                {textoDeDias(inicio, fin)} · hasta 32. Los precios se calculan al último día.
              </p>
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
            <div className="space-y-1.5">
              <Label htmlFor="consulta-hora">Hora de inicio estimada</Label>
              <SelectorHora
                id="consulta-hora"
                value={horaEstimada}
                onChange={setHoraEstimada}
                opcional
              />
              <p className="text-xs text-muted-foreground">La misma para todos los días.</p>
            </div>
            {tipo === 'Social' && (
              <div className="space-y-1.5">
                <Label htmlFor="consulta-hora-fin">Hora de fin estimada</Label>
                <SelectorHora
                  id="consulta-hora-fin"
                  value={horaFinEstimada}
                  onChange={setHoraFinEstimada}
                  horaSugerida={horaEstimada || undefined}
                  opcional
                  aria-invalid={!horarioEstimadoValido}
                />
              </div>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Resumen:{' '}
            {textoDePersonas(dias.map((d) => Number(d.personas) || 0).filter((n) => n > 0)) ||
              'sin personas'}{' '}
            · {resumenDeJornada(dias.map((d) => d.jornada)).texto}
          </p>
        </section>

        {/* HU-50: los salones que otros eventos ya ocupan en estos días (aviso preventivo, RN-12). */}
        {enCurso && <AvisoDeChoques consultaId={consulta.id} />}

        {/* El detalle de cada día: pestañas para pasar de uno a otro sin perder lo cargado. */}
        <section className="rounded-xl bg-card p-5 ring-1 ring-border">
          <h3 className="text-sm font-semibold">Detalle día por día</h3>
          <p className="text-xs text-muted-foreground">
            Precios unitarios sin IVA. Cada día tiene sus personas, salones y servicios: los de un
            día no se suman a los demás.
          </p>
          <div
            role="tablist"
            aria-label="Días del evento"
            className="mt-4 flex gap-2 overflow-x-auto pb-2"
          >
            {fechas.map((fecha, i) => {
              const d = dias[i] ?? diaVacio();
              const completo = diaValido(d) && (d.salonesSel.length > 0 || tipo === 'Social');
              return (
                <button
                  key={fecha}
                  type="button"
                  role="tab"
                  aria-selected={i === indice}
                  onClick={() => setActivo(i)}
                  className={cn(
                    'shrink-0 rounded-xl border-2 px-3 py-2 text-left text-xs transition-colors',
                    i === indice ? 'border-bordo bg-bordo/5' : 'border-border hover:border-dorado',
                    !diaValido(d) && 'border-destructive/60',
                  )}
                >
                  <span className="flex items-center gap-1.5 font-semibold text-bordo">
                    Día {i + 1} · <span className="capitalize">{nombreDeDia(fecha)}</span>
                    {completo && <Check className="size-3.5 text-emerald-700" />}
                  </span>
                  <span className="block text-muted-foreground">
                    {esEntero(d.personas) ? `${d.personas} personas` : 'sin personas'} ·{' '}
                    {d.salonesSel.length} {d.salonesSel.length === 1 ? 'salón' : 'salones'} ·{' '}
                    {formatearPesos(subtotalDelDia(d))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 border-t border-dashed pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="dia-personas" className="inline-flex items-center gap-1.5">
                <Users className="size-4 text-dorado" /> Personas el día {indice + 1}
              </Label>
              <InputEntero
                id="dia-personas"
                max={MAXIMO_PERSONAS_EVENTO}
                value={dia.personas}
                aria-invalid={!esEntero(dia.personas)}
                onChangeValor={(personas) => cambiarDia({ personas })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dia-jornada">Jornada</Label>
              <select
                id="dia-jornada"
                className={claseSelect}
                value={dia.jornada}
                onChange={(e) => cambiarJornada(e.target.value as TipoJornada)}
              >
                <option value="completa">Jornada completa</option>
                <option value="media">Media jornada (hasta 4 h)</option>
              </select>
            </div>
            {indice > 0 && (
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={copiarDiaAnterior}>
                  <Copy /> Copiar el día anterior
                </Button>
              </div>
            )}
          </div>

          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium">Salones del día {indice + 1}</legend>
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
            {tipo === 'Corporativo' && dia.salonesSel.length === 0 && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3.5" /> Un evento corporativo necesita al menos un
                salón cada día.
              </p>
            )}
            {excedeCapacidad && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                <AlertTriangle className="size-3.5" /> {dia.personas} personas superan la capacidad
                ({capacidadElegida}). Es un aviso: se puede guardar igual.
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
                Todo el presupuesto se proyectó con el incremento del {Number(porcentajeMensual)}%
                mensual a esa fecha, también los días que ya estaban.
              </p>
              <ResumenCambios cambios={cambiosPorFecha} />
              <p className="mt-2 text-xs">
                Total antes {formatearPesos(totalGuardado)} · ahora {formatearPesos(importes.total)}
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
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Este día entra vacío: elegí el salón y agregá los servicios, o copiá el día
                      anterior.
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
                                s.salonId === sel.salonId ? { ...s, precio: e.target.value } : s,
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
                              onChange={(modalidad) => actualizarLinea(linea.clave, { modalidad })}
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
                        aria-invalid={!esEntero(linea.cantidad) || !cantidadPosible(dia, linea)}
                        onChangeValor={(cantidad) => actualizarLinea(linea.clave, { cantidad })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <SelectorHora
                        aria-label={`Hora de ${linea.descripcion} (opcional)`}
                        value={linea.hora}
                        onChange={(hora) => actualizarLinea(linea.clave, { hora })}
                        opcional
                        placeholder="--:--"
                        horaSugerida={horaEstimada || undefined}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <InputImporte
                        aria-label={`Precio unitario de ${linea.descripcion}`}
                        sinSigno={aCotizar(linea)}
                        value={linea.precio}
                        placeholder={linea.tercerizado ? 'A cotizar' : undefined}
                        aria-invalid={!precioValido(linea)}
                        onChange={(e) => actualizarLinea(linea.clave, { precio: e.target.value })}
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
                          {s.nombre} · {s.precio === null ? 'a cotizar' : formatearPesos(s.precio)}
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
        </section>
      </fieldset>

      <section className="rounded-xl bg-card p-5 ring-1 ring-border">
        <h3 className="text-sm font-semibold">Total del evento</h3>
        <p className="text-xs text-muted-foreground">
          Un solo presupuesto y una sola seña para todos los días, que se calcula sobre este total.
        </p>
        <dl className="ml-auto mt-2 max-w-xs space-y-1.5 text-sm">
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

      {editable && (
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
            {guardadaConPreciosNuevos && ', con los precios actualizados al último día'}. ¿Querés{' '}
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
      {enCurso && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-5 ring-1 ring-border">
          <div className="max-w-xl">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarCheck className="size-4 text-dorado" /> Cobrar la seña
            </h3>
            <p className="text-xs text-muted-foreground">
              {consulta.salones.length === 0
                ? 'Primero elegí el salón de cada día, armá el presupuesto y guardá los cambios.'
                : `${expirado ? 'La consulta está vencida, pero la seña se cobra igual, sin recalcular. ' : ''}Registrá el horario de cada día y los pagos. Cuando lo pagado llega al ${PORCENTAJE_SENA}% de la base de cobro, el evento entero queda reservado: un choque en cualquier día lo impide. Guardá antes los cambios de la consulta.`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={consulta.salones.length === 0}
            onClick={() => onAbrirEvento(consulta.evento.id)}
          >
            <CalendarCheck /> Registrar pagos
          </Button>
        </section>
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
    </form>
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
