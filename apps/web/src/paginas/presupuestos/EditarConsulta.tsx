import {
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  ETIQUETAS_TIPO_EVENTO_SOCIAL,
  horaDelEvento,
  type ConsultaDetallada,
  type SalonConDistribuciones,
  type Servicio,
  type TipoEvento,
  type TipoEventoSocial,
  type TipoJornada,
} from '@confluens/shared';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Check,
  ClipboardList,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { BadgeTipoEvento } from '@/components/BadgeTipoEvento';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConsulta, useDarDeBajaConsulta, useModificarConsulta } from '@/hooks/use-presupuestos';
import { useSalones } from '@/hooks/use-salones';
import { useServicios } from '@/hooks/use-servicios';
import { ErrorApiCliente } from '@/lib/api';
import { agruparPorCategoria } from '@/lib/catalogo';
import { armadoDeSalones, formatearPesos, nombreCompleto } from '@/lib/formato';
import { cn } from '@/lib/utils';

// Una línea del detalle mientras se edita. servicioId null = adicional escrito a mano. Un
// tercerizado puede quedar con el precio vacío: "a cotizar" (HU-11).
interface LineaEditable {
  clave: string;
  servicioId: number | null;
  descripcion: string;
  cantidad: string;
  // "HH:mm" o '': a qué hora del evento se espera el servicio. Es opcional, y si el evento ya está
  // agendado la API rechaza con 422 una hora fuera de su horario.
  hora: string;
  precio: string;
  tercerizado: boolean;
}

// Un salón del evento mientras se edita: su precio se puede ajustar a mano (RN-03).
interface SalonEditable {
  salonId: number;
  precio: string;
}

const OTRO = 'otro';

const fechaCorta = (fecha: Date) =>
  fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const precioDeSalon = (salon: SalonConDistribuciones, jornada: TipoJornada) =>
  jornada === 'completa' ? salon.precioJornadaCompleta : salon.precioMediaJornada;

const esEntero = (valor: string) => /^\d+$/.test(valor) && Number(valor) > 0;
const esImporte = (valor: string) => /^\d{1,10}(\.\d{1,2})?$/.test(valor);
const subtotal = (cantidad: string, precio: string) =>
  esEntero(cantidad) && esImporte(precio) ? Number(cantidad) * Number(precio) : 0;
// HU-11: solo un tercerizado del catálogo puede quedar sin precio, a cotizar.
const aCotizar = (linea: LineaEditable) =>
  linea.precio === '' && linea.servicioId !== null && linea.tercerizado;
const precioValido = (linea: LineaEditable) => esImporte(linea.precio) || aCotizar(linea);

const hora = horaDelEvento;

const mensajeDeError = (error: unknown, porDefecto: string) =>
  error instanceof ErrorApiCliente ? error.message : porDefecto;

const ESTADOS: Record<string, string> = {
  Estimado: 'bg-muted text-foreground',
  Expirado: 'bg-amber-100 text-amber-900',
  Cancelado: 'bg-bordo/10 text-bordo',
  Confirmado: 'bg-emerald-100 text-emerald-900',
};

const claseSelect = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm';

const TIPOS_SOCIALES = Object.entries(ETIQUETAS_TIPO_EVENTO_SOCIAL) as [TipoEventoSocial, string][];

// HU-12: una consulta abierta desde el listado. Después de hablar con el cliente, el personal
// corrige fecha, salón, personas, jornada, servicios (del catálogo o escritos a mano), cantidades y
// precios. Al guardar queda Estimado, la vigencia vuelve a contar 10 días y se vuelve al listado.
// En una Expirado, «Recalcular» trae los precios vigentes al formulario: al guardar, la misma
// consulta vuelve a Estimado. Los datos del cliente son suyos: acá solo se muestran.
// ADR 0008: también se corrigen el tipo de evento y la hora estimada. Una consulta social llega sin
// salón ni servicios: el personal arma el presupuesto acá y la vigencia arranca al guardarlo.
export function EditarConsulta({
  id,
  onVolver,
  onGuardada,
  onDadaDeBaja,
  onAbrirEvento,
  onImprimirComanda,
  textoVolver = 'Volver a las consultas',
}: {
  id: number;
  onVolver: () => void;
  onGuardada: (consulta: ConsultaDetallada) => void;
  onDadaDeBaja: (consulta: ConsultaDetallada) => void;
  onAbrirEvento: (eventoId: number) => void;
  // Comanda de cocina del evento confirmado. Sin esto el botón no aparece: desde Consultas no se
  // llega a un presupuesto Confirmado, solo desde la agenda.
  onImprimirComanda?: (presupuestoId: number) => void;
  // Se abre desde Consultas o desde un evento de la agenda (HU-15).
  textoVolver?: string;
}) {
  const consulta = useConsulta(id);
  const salones = useSalones();
  const servicios = useServicios();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onVolver}>
        <ArrowLeft /> {textoVolver}
      </Button>
      {(consulta.isLoading || salones.isLoading || servicios.isLoading) && (
        <p className="text-sm text-muted-foreground">Cargando la consulta…</p>
      )}
      {(consulta.isError || salones.isError || servicios.isError) && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo cargar la consulta.
        </p>
      )}
      {consulta.data && salones.data && servicios.data && (
        <Formulario
          consulta={consulta.data}
          salones={salones.data}
          catalogo={servicios.data}
          onGuardada={onGuardada}
          onDadaDeBaja={onDadaDeBaja}
          onAbrirEvento={onAbrirEvento}
          onImprimirComanda={onImprimirComanda}
        />
      )}
    </div>
  );
}

function Formulario({
  consulta,
  salones,
  catalogo,
  onGuardada,
  onDadaDeBaja,
  onAbrirEvento,
  onImprimirComanda,
}: {
  consulta: ConsultaDetallada;
  salones: SalonConDistribuciones[];
  catalogo: Servicio[];
  onGuardada: (consulta: ConsultaDetallada) => void;
  onDadaDeBaja: (consulta: ConsultaDetallada) => void;
  onAbrirEvento: (eventoId: number) => void;
  onImprimirComanda?: (presupuestoId: number) => void;
}) {
  const modificar = useModificarConsulta(consulta.id);
  const darDeBaja = useDarDeBajaConsulta(consulta.id);

  // Precio congelado de cada salón que ya estaba en el presupuesto: vuelve a usarse si se lo
  // destilda y se lo vuelve a tildar sin cambiar la jornada.
  const preciosOriginales = new Map(
    consulta.lineas
      .filter((linea) => linea.tipo === 'salon' && linea.salonId !== null)
      .map((linea) => [linea.salonId!, linea.precioUnitario]),
  );
  const [fecha, setFecha] = useState(consulta.evento.fecha);
  // Los salones del evento, cada uno con su precio editable (RN-03), en el orden de las líneas.
  // Vacío: consulta social todavía sin salón (ADR 0008). Un evento puede usar varios a la vez,
  // incluso los cinco (ADR 0011).
  const [salonesSel, setSalonesSel] = useState<SalonEditable[]>(
    consulta.lineas
      .filter((linea) => linea.tipo === 'salon' && linea.salonId !== null)
      .map((linea) => ({ salonId: linea.salonId!, precio: linea.precioUnitario })),
  );
  const [tipo, setTipo] = useState<TipoEvento>(consulta.evento.tipo);
  const [tipoSocial, setTipoSocial] = useState<TipoEventoSocial | ''>(
    consulta.evento.tipoSocial ?? '',
  );
  const [detalleOtro, setDetalleOtro] = useState(consulta.evento.tipoSocialDetalle ?? '');
  const [horaEstimada, setHoraEstimada] = useState(consulta.evento.horaInicioEstimada ?? '');
  const [jornada, setJornada] = useState<TipoJornada>(consulta.tipoJornada);
  const [personas, setPersonas] = useState(String(consulta.evento.cantidadPersonas));
  const [requiereFactura, setRequiereFactura] = useState(consulta.requiereFactura);
  const [lineas, setLineas] = useState<LineaEditable[]>(
    consulta.lineas
      .filter((linea) => linea.tipo !== 'salon')
      .map((linea) => ({
        clave: `linea-${linea.id}`,
        servicioId: linea.servicioId,
        descripcion: linea.descripcion,
        cantidad: String(linea.cantidad),
        hora: linea.horaEstimada ?? '',
        precio: linea.aCotizar ? '' : linea.precioUnitario,
        tercerizado: linea.tercerizado,
      })),
  );
  const [agregar, setAgregar] = useState('');
  const [otro, setOtro] = useState({ descripcion: '', cantidad: '1', precio: '' });
  const [recalculado, setRecalculado] = useState(false);

  const enCurso =
    (consulta.estado === 'Estimado' || consulta.estado === 'Expirado') &&
    consulta.evento.estado === 'EnConsulta';
  // RN-09: el Responsable de Eventos modifica en todo momento, también un evento ya confirmado
  // (decisión de Franco, 08/10/2026). Sigue Confirmado: ni vigencia ni baja, y el estado del evento
  // (Reservado o Cobrado) lo recalcula la API con lo pagado contra el total nuevo.
  const confirmado =
    consulta.estado === 'Confirmado' &&
    (consulta.evento.estado === 'Reservado' || consulta.evento.estado === 'Cobrado');
  const editable = enCurso || confirmado;
  const expirado = consulta.estado === 'Expirado';
  const salonDe = (salonId: number) => salones.find((s) => s.id === salonId);
  const capacidadElegida = salonesSel.reduce(
    (suma, s) => suma + (salonDe(s.salonId)?.capacidadMaxima ?? 0),
    0,
  );

  // Un salón vuelve a su precio congelado si estaba en el presupuesto y la jornada es la
  // original; si no, toma el vigente. Después se puede ajustar a mano (RN-03).
  function precioInicial(salonId: number, conJornada: TipoJornada): string {
    const congelado = preciosOriginales.get(salonId);
    if (congelado && conJornada === consulta.tipoJornada && !recalculado) return congelado;
    const salon = salonDe(salonId);
    return salon ? precioDeSalon(salon, conJornada) : '0.00';
  }

  function alternarSalon(salonId: number) {
    setSalonesSel((anteriores) =>
      anteriores.some((s) => s.salonId === salonId)
        ? anteriores.filter((s) => s.salonId !== salonId)
        : [...anteriores, { salonId, precio: precioInicial(salonId, jornada) }],
    );
  }

  // Cambiar la jornada cambia el precio de todos los salones a la vez.
  function cambiarJornada(nuevaJornada: TipoJornada) {
    setJornada(nuevaJornada);
    setSalonesSel((anteriores) =>
      anteriores.map((s) => ({ ...s, precio: precioInicial(s.salonId, nuevaJornada) })),
    );
  }

  function cambiarPrecioSalon(salonId: number, precio: string) {
    setSalonesSel((anteriores) =>
      anteriores.map((s) => (s.salonId === salonId ? { ...s, precio } : s)),
    );
  }

  // RN-06 / HU-12: un Expirado se recalcula con los precios vigentes del salón y de cada servicio
  // del catálogo. Los adicionales escritos a mano conservan su precio. Se guarda con «Guardar».
  function recalcularPrecios() {
    setSalonesSel((anteriores) =>
      anteriores.map((s) => {
        const salon = salonDe(s.salonId);
        return salon ? { ...s, precio: precioDeSalon(salon, jornada) } : s;
      }),
    );
    setLineas((anteriores) =>
      anteriores.map((linea) => {
        const servicio = catalogo.find((s) => s.id === linea.servicioId);
        // Un tercerizado que sigue a cotizar en el catálogo conserva lo que tenía.
        return servicio?.precio != null ? { ...linea, precio: servicio.precio } : linea;
      }),
    );
    setRecalculado(true);
  }

  function actualizarLinea(clave: string, cambios: Partial<LineaEditable>) {
    setLineas((anteriores) =>
      anteriores.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)),
    );
  }

  // Un servicio del catálogo entra con el precio vigente; si es por persona, para todas las
  // personas. «Otro» entra con lo que se escribió a mano.
  function agregarLinea() {
    if (agregar === OTRO) {
      setLineas((anteriores) => [
        ...anteriores,
        {
          clave: `otro-${Date.now()}`,
          servicioId: null,
          descripcion: otro.descripcion.trim(),
          cantidad: otro.cantidad,
          hora: '',
          precio: otro.precio,
          tercerizado: false,
        },
      ]);
      setOtro({ descripcion: '', cantidad: '1', precio: '' });
    } else {
      const servicio = catalogo.find((s) => s.id === Number(agregar));
      if (!servicio) return;
      setLineas((anteriores) => [
        ...anteriores,
        {
          clave: `servicio-${servicio.id}`,
          servicioId: servicio.id,
          descripcion: servicio.nombre,
          cantidad: servicio.porPersona && esEntero(personas) ? personas : '1',
          hora: '',
          precio: servicio.precio ?? '',
          tercerizado: servicio.tercerizado,
        },
      ]);
    }
    setAgregar('');
  }

  const disponibles = catalogo.filter(
    (s) => s.activo && !lineas.some((l) => l.servicioId === s.id),
  );
  const otroValido =
    otro.descripcion.trim().length > 0 && esEntero(otro.cantidad) && esImporte(otro.precio);
  const puedeAgregar = agregar === OTRO ? otroValido : !!agregar;

  // Un corporativo necesita salón; un social, su tipo ("Otro" con su detalle).
  const tipoValido =
    tipo === 'Corporativo'
      ? salonesSel.length > 0
      : !!tipoSocial && (tipoSocial !== 'Otro' || !!detalleOtro.trim());
  const { inicio, fin } = consulta.evento;
  const armado = armadoDeSalones(consulta.salones);
  // La franja del evento, solo si ya está agendado: la hora de un servicio tiene que caer adentro
  // y la API la rechaza con 422 si no. Mientras la consulta no se agenda no hay con qué limitar
  // (ADR 0007: el horario real se carga después), así que se acepta cualquier hora. Un evento que
  // cruza la medianoche se deja pasar, igual que en la API: el rango daría vuelta.
  const franja =
    inicio && fin && hora(inicio) < hora(fin) ? { desde: hora(inicio), hasta: hora(fin) } : null;
  // Las horas son "HH:mm" con cero adelante, así que alcanza con compararlas como texto.
  const horaValida = (linea: LineaEditable) =>
    !linea.hora || !franja || (linea.hora >= franja.desde && linea.hora <= franja.hasta);
  const valido =
    !!fecha &&
    esEntero(personas) &&
    tipoValido &&
    salonesSel.every((s) => esImporte(s.precio)) &&
    // Un evento confirmado ocupa un salón: no puede quedar «a definir».
    (!confirmado || salonesSel.length > 0) &&
    lineas.every(
      (l) => esEntero(l.cantidad) && precioValido(l) && horaValida(l) && l.descripcion.trim(),
    );
  // Sin salón ni líneas, el presupuesto sigue sin armar y no arranca la vigencia (ADR 0008).
  const quedaSinArmar = salonesSel.length === 0 && lineas.length === 0;
  const cantidadACotizar = lineas.filter(aCotizar).length;

  // RN-05: los importes se cargan sin IVA y el resumen muestra el desglose.
  const importes = desglosarIva(
    salonesSel.reduce((suma, s) => suma + (esImporte(s.precio) ? Number(s.precio) : 0), 0) +
      lineas.reduce((suma, l) => suma + subtotal(l.cantidad, l.precio), 0),
  );
  // Es un dato, no un tope: la capacidad no bloquea (ADR 0011). Con varios salones cuenta la suma.
  const excedeCapacidad =
    salonesSel.length > 0 && esEntero(personas) && Number(personas) > capacidadElegida;

  // Se mandan los precios que se ven: lo que se guarda es exactamente lo que está en pantalla.
  function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    const aImporte = (valor: string) => Number(valor).toFixed(2);
    modificar.mutate(
      {
        fecha,
        salones: salonesSel.map((s) => ({
          salonId: s.salonId,
          precioUnitario: aImporte(s.precio),
        })),
        cantidadPersonas: Number(personas),
        tipoJornada: jornada,
        tipo,
        tipoSocial: tipo === 'Social' && tipoSocial ? tipoSocial : null,
        tipoSocialDetalle: tipo === 'Social' && tipoSocial === 'Otro' ? detalleOtro.trim() : null,
        horaInicioEstimada: horaEstimada || null,
        requiereFactura,
        servicios: lineas
          .filter((l) => l.servicioId !== null)
          .map((l) => ({
            servicioId: l.servicioId!,
            cantidad: Number(l.cantidad),
            horaEstimada: l.hora || undefined,
            // Sin precio, el tercerizado queda a cotizar (HU-11).
            precioUnitario: aCotizar(l) ? undefined : aImporte(l.precio),
          })),
        adicionales: lineas
          .filter((l) => l.servicioId === null)
          .map((l) => ({
            descripcion: l.descripcion.trim(),
            cantidad: Number(l.cantidad),
            horaEstimada: l.hora || undefined,
            precioUnitario: aImporte(l.precio),
          })),
      },
      { onSuccess: onGuardada },
    );
  }

  function confirmarBaja() {
    if (!window.confirm(`¿Dar de baja la consulta ${consulta.id}? Va a quedar como Cancelado.`)) {
      return;
    }
    darDeBaja.mutate(undefined, { onSuccess: onDadaDeBaja });
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Un Confirmado ya no es una consulta: pasó a la agenda (HU-11 desde HU-15). */}
          <h2 className="text-xl font-semibold text-bordo">
            {consulta.estado === 'Confirmado' ? 'Presupuesto' : 'Consulta'} {consulta.id}
          </h2>
          <p className="text-sm text-muted-foreground">
            Emitida el {fechaCorta(new Date(consulta.fechaEmision))} ·{' '}
            {consulta.venceEn
              ? `vence el ${fechaCorta(new Date(consulta.venceEn))}`
              : 'presupuesto sin armar'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeTipoEvento evento={consulta.evento} />
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              ESTADOS[consulta.estado] ?? '',
            )}
          >
            {consulta.estado}
          </span>
        </div>
      </header>

      {expirado && enCurso && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" />
            {recalculado
              ? 'Precios actualizados a los vigentes. Guardá los cambios para que vuelva a Estimado.'
              : 'Presupuesto vencido, recalcular'}
          </p>
          {!recalculado && (
            <Button type="button" size="sm" variant="outline" onClick={recalcularPrecios}>
              <RefreshCw /> Recalcular con precios vigentes
            </Button>
          )}
        </div>
      )}
      {confirmado && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p>
            Evento confirmado: podés modificar todo y sigue confirmado. Si cambia el total, cambia
            el saldo a cobrar; si cambiás la fecha, el horario se corre al mismo día.
          </p>
          {onImprimirComanda && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onImprimirComanda(consulta.id)}
            >
              <Printer /> Comanda de cocina
            </Button>
          )}
        </div>
      )}
      {!editable && (
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

      <fieldset disabled={!editable} className="space-y-6">
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
                className={claseSelect}
                value={jornada}
                onChange={(e) => cambiarJornada(e.target.value as TipoJornada)}
              >
                <option value="completa">Jornada completa</option>
                <option value="media">Media jornada (hasta 4 h)</option>
              </select>
            </div>
          </div>
          {/* Un evento puede ocupar varios salones a la vez, incluso los cinco (ADR 0011). */}
          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium">Salones</legend>
            <div className="flex flex-wrap gap-2">
              {salones.map((s) => {
                const elegido = salonesSel.some((sel) => sel.salonId === s.id);
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
            {salonesSel.length > 1 && (
              <p className="text-xs text-muted-foreground">
                {salonesSel.length} salones · capacidad sumada {capacidadElegida} personas
              </p>
            )}
          </fieldset>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <Input
                id="consulta-hora"
                type="time"
                value={horaEstimada}
                onChange={(e) => setHoraEstimada(e.target.value)}
              />
            </div>
          </div>
          {tipo === 'Corporativo' && salonesSel.length === 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertTriangle className="size-3.5" /> Un evento corporativo necesita al menos un
              salón.
            </p>
          )}
          {excedeCapacidad && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-900">
              <AlertTriangle className="size-3.5" /> {personas} personas superan la capacidad{' '}
              {salonesSel.length > 1 ? 'sumada de los salones' : 'del salón'} ({capacidadElegida}).
              Es un aviso: se puede guardar igual.
            </p>
          )}
          <p className="mt-4 text-sm">
            <span className="text-muted-foreground">Distribución y horario: </span>
            {armado && inicio && fin
              ? `${armado} · de ${hora(inicio)} a ${hora(fin)}`
              : 'sin agendar todavía (se cargan al registrar el pago)'}
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requiereFactura}
              onChange={(e) => setRequiereFactura(e.target.checked)}
            />
            El cliente requiere factura
            <span className="text-xs text-muted-foreground">
              (la seña y el saldo se calculan sobre el total con IVA)
            </span>
          </label>
        </section>

        {tipo === 'Social' && (
          <section className="rounded-xl bg-card p-5 ring-1 ring-rose-200">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="size-4 text-rose-700" /> Detalle del evento social
            </h3>
            {/* Vacío a propósito: falta la plantilla de campos del evento social (pendientes.md). */}
            <div className="mt-3 rounded-lg border border-dashed border-rose-200 px-4 py-8 text-center text-sm text-muted-foreground">
              Todavía no hay plantilla para los eventos sociales. Acá van a ir los datos propios del
              evento.
            </div>
          </section>
        )}

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
                  {/* Opcional: a qué hora del evento se espera cada servicio. El salón no lleva,
                      su horario es el del evento. Agendado el evento, se limita a su franja. */}
                  <th className="w-28 pb-2 font-medium">
                    Hora
                    {franja && (
                      <span className="block font-normal">
                        {franja.desde} a {franja.hasta}
                      </span>
                    )}
                  </th>
                  <th className="w-36 pb-2 font-medium">Precio unitario</th>
                  <th className="w-32 pb-2 text-right font-medium">Subtotal</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {quedaSinArmar && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Presupuesto sin armar: elegí el salón y agregá los servicios.
                    </td>
                  </tr>
                )}
                {/* Una línea por salón, cada una con su precio ajustable (RN-03). */}
                {salonesSel.map((sel) => {
                  const nombre = salonDe(sel.salonId)?.nombre ?? '';
                  return (
                    <tr key={`salon-${sel.salonId}`}>
                      <td className="py-2 pr-3">
                        Salón {nombre} (
                        {jornada === 'completa' ? 'jornada completa' : 'media jornada'})
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">1</td>
                      <td className="py-2 pr-3 text-muted-foreground">—</td>
                      <td className="py-2 pr-3">
                        <Input
                          aria-label={`Precio del salón ${nombre}`}
                          inputMode="decimal"
                          value={sel.precio}
                          aria-invalid={!esImporte(sel.precio)}
                          onChange={(e) => cambiarPrecioSalon(sel.salonId, e.target.value)}
                        />
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {esImporte(sel.precio) ? formatearPesos(sel.precio) : '—'}
                      </td>
                      <td />
                    </tr>
                  );
                })}
                {lineas.map((linea) => (
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
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Cantidad de ${linea.descripcion}`}
                        type="number"
                        min={1}
                        value={linea.cantidad}
                        aria-invalid={!esEntero(linea.cantidad)}
                        onChange={(e) => actualizarLinea(linea.clave, { cantidad: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Hora de ${linea.descripcion} (opcional)`}
                        type="time"
                        value={linea.hora}
                        // min y max no impiden tipear una hora de más: marcan el campo y lo
                        // bloquea horaValida, que es lo que deshabilita «Guardar».
                        min={franja?.desde}
                        max={franja?.hasta}
                        aria-invalid={!horaValida(linea)}
                        onChange={(e) => actualizarLinea(linea.clave, { hora: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        aria-label={`Precio unitario de ${linea.descripcion}`}
                        inputMode="decimal"
                        value={linea.precio}
                        placeholder={linea.tercerizado ? 'A cotizar' : undefined}
                        aria-invalid={!precioValido(linea)}
                        onChange={(e) => actualizarLinea(linea.clave, { precio: e.target.value })}
                      />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {aCotizar(linea) ? (
                        <span className="text-xs font-medium text-amber-900">A cotizar</span>
                      ) : esEntero(linea.cantidad) && esImporte(linea.precio) ? (
                        formatearPesos(subtotal(linea.cantidad, linea.precio))
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
                          setLineas((anteriores) =>
                            anteriores.filter((l) => l.clave !== linea.clave),
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

          {/* Pasa cuando se reprograma el evento y alguna hora queda afuera de la franja nueva.
              Sin esto el aviso llegaría recién al guardar, con el 422 de la API. */}
          {franja && lineas.some((l) => !horaValida(l)) && (
            <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                {lineas
                  .filter((l) => !horaValida(l))
                  .map((l) => l.descripcion.trim() || 'Un servicio')
                  .join(', ')}{' '}
                {lineas.filter((l) => !horaValida(l)).length === 1 ? 'queda' : 'quedan'} fuera del
                horario del evento, que va de {franja.desde} a {franja.hasta}.
              </span>
            </p>
          )}

          <div className="mt-4 space-y-3 rounded-lg bg-muted/50 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="consulta-agregar">Agregar servicio</Label>
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
                  <Input
                    id="otro-cantidad"
                    className="bg-card"
                    type="number"
                    min={1}
                    value={otro.cantidad}
                    onChange={(e) => setOtro({ ...otro, cantidad: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="otro-precio">Precio sin IVA</Label>
                  <Input
                    id="otro-precio"
                    className="bg-card"
                    inputMode="decimal"
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
          {/* Un evento confirmado no se da de baja desde acá: se cancela desde el evento (RN-07). */}
          {enCurso ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={darDeBaja.isPending}
              onClick={confirmarBaja}
            >
              <Trash2 /> Dar de baja
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-xs text-muted-foreground">
              {confirmado
                ? 'Al guardar, el evento sigue confirmado y el saldo se recalcula con el total nuevo.'
                : quedaSinArmar
                  ? 'Sin salón ni servicios, el presupuesto sigue sin armar.'
                  : `Al guardar, la vigencia vuelve a contar ${DIAS_VIGENCIA_PRESUPUESTO} días.`}
            </p>
            <Button type="submit" disabled={!valido || modificar.isPending}>
              {modificar.isPending ? 'Guardando…' : 'Guardar cambios'}
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
              {expirado
                ? 'La consulta está vencida: recalculala y guardá los cambios antes de cobrar la seña.'
                : consulta.salones.length === 0
                  ? 'Primero elegí el salón, armá el presupuesto y guardá los cambios.'
                  : 'Registrá los pagos junto con la distribución y el horario del evento. Cuando lo pagado llega al 20% de la base de cobro, el evento queda confirmado y pasa a la agenda (HU-13). Guardá antes los cambios de la consulta.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={expirado || consulta.salones.length === 0}
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
    </form>
  );
}
