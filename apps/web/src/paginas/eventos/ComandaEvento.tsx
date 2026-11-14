import { horaDelEvento, NOMBRE_MODALIDAD, type ConsultaDetallada } from '@confluens/shared';
import { ArrowLeft, Printer, Save } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGuardarObservacionesComanda } from '@/hooks/use-eventos';
import { useConsulta } from '@/hooks/use-presupuestos';
import {
  armadoDeSalones,
  fechaLocal,
  formatearFecha,
  nombreCompleto,
  nombresDeSalones,
} from '@/lib/formato';
import { cn } from '@/lib/utils';

import { lineasDeComanda } from './lineas-comanda';

// Comanda de cocina de un evento ya confirmado: la hoja que se imprime y se cuelga en la cocina.
// Lleva fecha, salón, horario, cantidad de personas y los servicios de gastronomía ordenados por
// la hora a la que se los espera. **Sin precios**: no es un documento comercial.
//
// Se imprime con el diálogo del navegador (window.print()), igual que el presupuesto del cliente
// en PresupuestoEstimado.tsx: sin dependencias nuevas y permite guardar como PDF. Todo lo que no
// va al papel lleva `print:hidden`.
//
// Qué entra y qué no lo decide lineasDeComanda, aparte para poder testearlo (HU-29).

const hora = horaDelEvento;

/**
 * La comanda se aprieta sola para entrar en una hoja. Medido sobre una A4 con los 14 mm de margen
 * de index.css: quedan 1017 px de alto útil y cada renglón mide 53 px holgado, 45 medio y 33
 * compacto. Cada escalón achica también la fecha, la banda de datos y el recuadro de
 * observaciones, no solo la tabla, que es de donde sale el lugar para los renglones de más.
 *
 * No se mide el alto en vivo a propósito: el navegador pagina recién al imprimir, así que medir
 * en pantalla para adivinar el papel sale caro y falla igual. Tres escalones fijos por cantidad
 * de renglones son predecibles y se ven iguales en pantalla y en papel.
 *
 * Pasados los 16 servicios la hoja se parte, que es lo correcto: achicar más la dejaría
 * ilegible, y el encabezado de la tabla se repite solo en la hoja siguiente.
 */
const DENSIDADES = {
  holgada: {
    fecha: 'text-3xl',
    banda: 'mt-6 gap-5 py-5',
    dato: 'text-xl',
    hora: 'py-3 text-xl',
    descripcion: 'py-3 text-lg',
    cantidad: 'py-3 text-xl',
    observaciones: 'min-h-28',
  },
  media: {
    fecha: 'text-2xl',
    banda: 'mt-4 gap-4 py-4',
    dato: 'text-lg',
    hora: 'py-2 text-lg',
    descripcion: 'py-2 text-base',
    cantidad: 'py-2 text-lg',
    observaciones: 'min-h-20',
  },
  compacta: {
    fecha: 'text-xl',
    banda: 'mt-3 gap-3 py-3',
    dato: 'text-base',
    hora: 'py-1 text-base',
    descripcion: 'py-1 text-sm',
    cantidad: 'py-1 text-base',
    observaciones: 'min-h-14',
  },
} as const;

type Densidad = (typeof DENSIDADES)[keyof typeof DENSIDADES];

// Los cortes salen de medir la hoja renderizada, no de estimarla: con 6 renglones holgados mide
// 929 px, con 9 medios 964 y con 16 compactos 1017, contra los 1017 px de alto útil de la A4. Se
// deja margen en cada escalón porque al imprimir la hoja es un poco más angosta que en pantalla y
// alguna descripción larga puede pasar a dos renglones.
function densidadPara(renglones: number): Densidad {
  if (renglones <= 6) return DENSIDADES.holgada;
  if (renglones <= 9) return DENSIDADES.media;
  return DENSIDADES.compacta;
}

function Dato({ rotulo, valor, densidad }: { rotulo: string; valor: string; densidad: Densidad }) {
  return (
    <div>
      <p className="text-[0.6rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className={cn('mt-1 font-semibold text-bordo print:text-black', densidad.dato)}>{valor}</p>
    </div>
  );
}

// Las tres columnas de la comanda, iguales para la gastronomía y para los ítems escritos a mano:
// cuándo, qué y para cuántos. Los números van en versales grandes y alineados a la derecha para
// poder leerlos de lejos; la hora, a la izquierda, porque es por donde se recorre la hoja.
function TablaServicios({
  lineas,
  densidad,
}: {
  lineas: ConsultaDetallada['lineas'];
  densidad: Densidad;
}) {
  return (
    <table className="mt-3 w-full border-collapse text-left">
      {/* Si la hoja se parte, el navegador repite solo el thead en la siguiente. */}
      <thead>
        <tr className="border-b border-bordo/40 text-[0.6rem] tracking-[0.2em] text-muted-foreground uppercase print:border-black/50">
          <th className="w-28 pb-1.5 font-semibold">Horario</th>
          <th className="pb-1.5 font-semibold">Descripción</th>
          <th className="w-28 pb-1.5 text-right font-semibold">Personas</th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((linea) => (
          <tr
            key={linea.id}
            className="border-b border-border/70 break-inside-avoid print:border-black/20"
          >
            <td className={cn('pr-3 font-serif font-semibold tabular-nums', densidad.hora)}>
              {/* Sin hora pedida: el guion deja la columna pareja y se nota que falta definirla. */}
              {linea.horaEstimada ?? '—'}
            </td>
            <td className={cn('pr-3', densidad.descripcion)}>
              {linea.descripcion}
              {/* RN-11: cocina y salón tienen que saber si el coffee es continuo o en mesas. */}
              {linea.modalidad !== 'Normal' && (
                <span className="ml-2 text-sm font-semibold">
                  · {NOMBRE_MODALIDAD[linea.modalidad]}
                </span>
              )}
            </td>
            <td
              className={cn('text-right font-serif font-semibold tabular-nums', densidad.cantidad)}
            >
              {linea.cantidad}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Lo que cambia de una hoja a otra: con un evento de varios días sale una comanda POR DÍA, con los
// salones, el horario, las personas y los servicios de ese día (HU-50). Un evento de un solo día
// tiene una hoja, como siempre.
interface DiaDeLaHoja {
  indice: number;
  total: number;
  datos: ConsultaDetallada['dias'][number];
}

// Las notas del evento (Evento.observacionesComanda) son una sola para todo el evento: se editan en
// la primera hoja y las demás las repiten, para que cada hoja se cuelgue en la cocina por sí sola.
interface NotasDeLaComanda {
  texto: string;
  onTexto: (texto: string) => void;
  sinGuardar: boolean;
  guardando: boolean;
  falloAlGuardar: boolean;
  onGuardar: () => void;
}

function Observaciones({
  notas,
  densidad,
  editable,
}: {
  notas: NotasDeLaComanda;
  densidad: Densidad;
  editable: boolean;
}) {
  // Estas hojas siempre terminan con algo anotado: menús especiales, alergias, a quién buscar. Se
  // escribe acá y queda guardado en el evento, o se deja vacío y se anota a mano sobre el papel. En el
  // papel va el texto tipeado, no el campo: un textarea con alto fijo recortaría lo que no entra, y
  // encima imprimiría el borde del control.
  return (
    <section className="mt-8 break-inside-avoid">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={editable ? 'comanda-observaciones' : undefined}
          className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
        >
          Observaciones
        </label>
        {editable && (
          <div className="flex items-center gap-2 print:hidden">
            {notas.falloAlGuardar && (
              <span className="text-xs text-destructive">No se pudieron guardar</span>
            )}
            {notas.sinGuardar ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={notas.guardando}
                onClick={notas.onGuardar}
              >
                <Save /> {notas.guardando ? 'Guardando…' : 'Guardar'}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Guardadas</span>
            )}
          </div>
        )}
      </div>
      {editable && (
        <Textarea
          id="comanda-observaciones"
          value={notas.texto}
          onChange={(e) => notas.onTexto(e.target.value)}
          placeholder="Menús especiales, alergias, contacto en el salón, lo que haga falta…"
          className={cn('mt-2 border-dashed print:hidden', densidad.observaciones)}
        />
      )}
      <div
        className={cn(
          'mt-2 rounded-md border border-dashed border-black/40 px-3 py-2 whitespace-pre-wrap',
          editable ? 'hidden print:block' : 'text-sm',
          densidad.observaciones,
        )}
      >
        {notas.texto}
      </div>
    </section>
  );
}

function Hoja({
  consulta,
  dia,
  notas,
  ultima,
}: {
  consulta: ConsultaDetallada;
  dia?: DiaDeLaHoja;
  notas: NotasDeLaComanda;
  ultima: boolean;
}) {
  const { evento } = consulta;
  // Con varios días, las líneas, los salones, el horario y las personas son los de este día.
  const lineasDelDia = dia
    ? consulta.lineas.filter((linea) => linea.diaId === dia.datos.id)
    : consulta.lineas;
  const salones = dia
    ? dia.datos.salones.map((salon) => ({ ...salon, capacidadMaxima: salon.capacidadMaxima }))
    : consulta.salones;
  const fecha = dia ? dia.datos.fecha : evento.fecha;
  const inicio = dia ? dia.datos.inicio : evento.inicio;
  const fin = dia ? dia.datos.fin : evento.fin;
  const personas = dia ? dia.datos.cantidadPersonas : evento.cantidadPersonas;
  const { gastronomia, aMano } = lineasDeComanda(lineasDelDia);
  const horario = inicio && fin ? `${hora(inicio)} a ${hora(fin)}` : 'A confirmar';
  // Cuenta los dos bloques: los dos ocupan renglones en la misma hoja.
  const densidad = densidadPara(gastronomia.length + aMano.length);

  return (
    <article
      className={cn(
        'mx-auto max-w-3xl rounded-xl bg-card p-8 ring-1 ring-border print:max-w-none print:rounded-none print:p-0 print:ring-0',
        // Cada día sale en su propia hoja.
        !ultima && 'print:break-after-page',
      )}
    >
      <header className="flex items-baseline justify-between gap-4 border-b-2 border-bordo pb-3 print:border-black">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-bordo print:text-black">
            Comanda de evento
            {dia && (
              <span className="ml-3 text-lg font-normal">
                · Día {dia.indice + 1} de {dia.total}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">Los Abuelos · Hotel Dr. César Carman</p>
        </div>
        <p className="font-serif text-lg tabular-nums">N° {String(consulta.id).padStart(6, '0')}</p>
      </header>

      <p
        className={cn(
          'mt-6 font-serif font-semibold text-bordo uppercase print:text-black',
          densidad.fecha,
        )}
      >
        {formatearFecha(fechaLocal(fecha), true)}
      </p>

      <div
        className={cn(
          'grid grid-cols-2 border-y border-border sm:grid-cols-4 print:border-black/30',
          densidad.banda,
        )}
      >
        <Dato
          rotulo={salones.length === 1 ? 'Salón' : 'Salones'}
          valor={nombresDeSalones(salones)}
          densidad={densidad}
        />
        <Dato rotulo="Armado" valor={armadoDeSalones(salones) ?? 'A definir'} densidad={densidad} />
        <Dato rotulo="Horario" valor={horario} densidad={densidad} />
        <Dato rotulo="Personas" valor={String(personas)} densidad={densidad} />
      </div>

      <p className="mt-4 text-sm">
        <span className="text-muted-foreground">Cliente: </span>
        <span className="font-medium">{nombreCompleto(consulta.cliente)}</span>
      </p>

      <section className="mt-8 break-inside-avoid">
        <h3 className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Gastronomía
        </h3>
        {gastronomia.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {dia ? 'Este día no tiene' : 'Este evento no tiene'} servicios de gastronomía cargados.
          </p>
        ) : (
          <TablaServicios lineas={gastronomia} densidad={densidad} />
        )}
      </section>

      {aMano.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <h3 className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Otros ítems cargados a mano
          </h3>
          <TablaServicios lineas={aMano} densidad={densidad} />
        </section>
      )}

      <Observaciones notas={notas} densidad={densidad} editable={!dia || dia.indice === 0} />
    </article>
  );
}

// Las hojas de la comanda: una por día. Las notas se escriben una sola vez para todo el evento: el
// borrador vive acá mientras se escribe y se manda con «Guardar», porque guardar en cada tecla
// pegaría a la API en cada letra.
function Comanda({ consulta }: { consulta: ConsultaDetallada }) {
  const { evento } = consulta;
  const [texto, setTexto] = useState(evento.observacionesComanda ?? '');
  const guardar = useGuardarObservacionesComanda(evento.id);
  const notas: NotasDeLaComanda = {
    texto,
    onTexto: setTexto,
    sinGuardar: texto.trim() !== (evento.observacionesComanda ?? ''),
    guardando: guardar.isPending,
    falloAlGuardar: guardar.isError,
    onGuardar: () => guardar.mutate(texto.trim()),
  };
  if (consulta.dias.length <= 1) {
    return <Hoja consulta={consulta} notas={notas} ultima />;
  }
  return (
    <div className="space-y-6 print:space-y-0">
      {consulta.dias.map((datos, indice) => (
        <Hoja
          key={datos.id}
          consulta={consulta}
          dia={{ indice, total: consulta.dias.length, datos }}
          notas={notas}
          ultima={indice === consulta.dias.length - 1}
        />
      ))}
    </div>
  );
}

export function ComandaEvento({
  presupuestoId,
  onVolver,
}: {
  presupuestoId: number;
  onVolver: () => void;
}) {
  const consulta = useConsulta(presupuestoId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={onVolver}>
          <ArrowLeft /> Volver al evento
        </Button>
        {consulta.data && (
          <Button size="sm" onClick={() => window.print()}>
            <Printer />{' '}
            {consulta.data.dias.length > 1
              ? `Imprimir las ${consulta.data.dias.length} comandas`
              : 'Imprimir comanda'}
          </Button>
        )}
      </div>

      {consulta.isLoading && <p className="text-sm text-muted-foreground">Cargando la comanda…</p>}
      {consulta.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo cargar la comanda.
        </p>
      )}
      {consulta.data && consulta.data.estado !== 'Confirmado' && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 print:hidden">
          Este presupuesto está {consulta.data.estado}: la comanda es del evento ya confirmado, así
          que lo que ves acá todavía puede cambiar.
        </p>
      )}
      {consulta.data && <Comanda consulta={consulta.data} />}
    </div>
  );
}
