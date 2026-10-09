import { horaDelEvento, type ConsultaDetallada } from '@confluens/shared';
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

// Comanda de cocina de un evento ya confirmado: la hoja que se imprime y se cuelga en la cocina.
// Lleva fecha, salón, horario, cantidad de personas y los servicios de gastronomía ordenados por
// la hora a la que se los espera. **Sin precios**: no es un documento comercial.
//
// Se imprime con el diálogo del navegador (window.print()), igual que el presupuesto del cliente
// en PresupuestoEstimado.tsx: sin dependencias nuevas y permite guardar como PDF. Todo lo que no
// va al papel lleva `print:hidden`.
//
// Qué entra y qué no: las líneas de servicio del catálogo que no son tercerizadas. Quedan afuera
// la línea del salón (su horario ya está en el encabezado) y los tercerizados, que son audiovisual
// y pantallas, no cocina. Los adicionales escritos a mano van aparte, al pie: pueden ser de cocina
// («torta de cumpleaños») o no («decoración»), y dejarlos afuera sería peor que mostrarlos.

const hora = horaDelEvento;

// Primero las que tienen hora, en orden; las que no, al final y en el orden en que se cargaron.
// Mezclarlas haría parecer que un servicio sin hora va a las 00:00.
function porHora(lineas: ConsultaDetallada['lineas']) {
  return [...lineas].sort((a, b) => {
    if (!a.horaEstimada && !b.horaEstimada) return 0;
    if (!a.horaEstimada) return 1;
    if (!b.horaEstimada) return -1;
    return a.horaEstimada.localeCompare(b.horaEstimada);
  });
}

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
            <td className={cn('pr-3', densidad.descripcion)}>{linea.descripcion}</td>
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

function Hoja({ consulta }: { consulta: ConsultaDetallada }) {
  const { evento } = consulta;
  // Se guardan en Evento.observacionesComanda. El borrador vive acá mientras se escribe y se
  // manda con «Guardar»: guardar en cada tecla pegaría a la API en cada letra.
  const [observaciones, setObservaciones] = useState(evento.observacionesComanda ?? '');
  const guardar = useGuardarObservacionesComanda(evento.id);
  const sinGuardar = observaciones.trim() !== (evento.observacionesComanda ?? '');
  const gastronomia = porHora(
    consulta.lineas.filter((l) => l.tipo === 'servicio' && !l.tercerizado),
  );
  const aMano = consulta.lineas.filter((l) => l.tipo === 'adicional');
  const horario =
    evento.inicio && evento.fin ? `${hora(evento.inicio)} a ${hora(evento.fin)}` : 'A confirmar';
  // Cuenta los dos bloques: los dos ocupan renglones en la misma hoja.
  const densidad = densidadPara(gastronomia.length + aMano.length);

  return (
    <article className="mx-auto max-w-3xl rounded-xl bg-card p-8 ring-1 ring-border print:max-w-none print:rounded-none print:p-0 print:ring-0">
      <header className="flex items-baseline justify-between gap-4 border-b-2 border-bordo pb-3 print:border-black">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-bordo print:text-black">
            Comanda de evento
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
        {formatearFecha(fechaLocal(evento.fecha), true)}
      </p>

      <div
        className={cn(
          'grid grid-cols-2 border-y border-border sm:grid-cols-4 print:border-black/30',
          densidad.banda,
        )}
      >
        <Dato
          rotulo={consulta.salones.length === 1 ? 'Salón' : 'Salones'}
          valor={nombresDeSalones(consulta.salones)}
          densidad={densidad}
        />
        <Dato
          rotulo="Armado"
          valor={armadoDeSalones(consulta.salones) ?? 'A definir'}
          densidad={densidad}
        />
        <Dato rotulo="Horario" valor={horario} densidad={densidad} />
        <Dato rotulo="Personas" valor={String(evento.cantidadPersonas)} densidad={densidad} />
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
            Este evento no tiene servicios de gastronomía cargados.
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

      {/* Estas hojas siempre terminan con algo anotado: menús especiales, alergias, a quién
          buscar. Se escribe acá y queda guardado en el evento, o se deja vacío y se anota a mano
          sobre el papel. En el papel va el texto tipeado, no el campo: un textarea con alto fijo
          recortaría lo que no entra, y encima imprimiría el borde del control. */}
      <section className="mt-8 break-inside-avoid">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="comanda-observaciones"
            className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
          >
            Observaciones
          </label>
          <div className="flex items-center gap-2 print:hidden">
            {guardar.isError && (
              <span className="text-xs text-destructive">No se pudieron guardar</span>
            )}
            {sinGuardar ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={guardar.isPending}
                onClick={() => guardar.mutate(observaciones.trim())}
              >
                <Save /> {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Guardadas</span>
            )}
          </div>
        </div>
        <Textarea
          id="comanda-observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Menús especiales, alergias, contacto en el salón, lo que haga falta…"
          className={cn('mt-2 border-dashed print:hidden', densidad.observaciones)}
        />
        <div
          className={cn(
            'mt-2 hidden rounded-md border border-dashed border-black/40 px-3 py-2 whitespace-pre-wrap print:block',
            densidad.observaciones,
          )}
        >
          {observaciones}
        </div>
      </section>
    </article>
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
            <Printer /> Imprimir comanda
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
      {consulta.data && <Hoja consulta={consulta.data} />}
    </div>
  );
}
