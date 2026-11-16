import { type EventoDetallado, horaDelEvento } from '@confluens/shared';
import { FileText, Pencil } from 'lucide-react';
import { useState } from 'react';

import { CintaDeDias, type DiaDeLaCinta } from '@/components/CintaDeDias';
import { AvisosDeLosDias, DatoDelDia, EncabezadoDelDia } from '@/components/PanelDelDia';
import { Button } from '@/components/ui/button';
import { useChoquesDeConsulta } from '@/hooks/use-presupuestos';
import {
  avisosDeLosDias,
  choquesPorFecha,
  estadoDeDiaDeEvento,
  resumenDelDia,
} from '@/lib/cinta-de-dias';
import { nombreDeJornada } from '@/lib/dias-del-evento';
import { textoModalidad } from '@/lib/formato';
import { jornadaDeHoras, textoHorarioEstimado } from '@/lib/jornada';
import { cn } from '@/lib/utils';
import { ObservacionesDelEvento } from './ObservacionesDelEvento';
import { presupuestoVigenteDe } from './presupuesto-vigente';

const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const formateadorFecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
});

type Linea = EventoDetallado['presupuestos'][number]['lineas'][number];
// La línea trae su día desde HU-50, aunque el esquema del evento todavía no lo declare.
const diaDeLinea = (linea: Linea) => (linea as { diaId?: number }).diaId;

/**
 * La pestaña Detalle de un evento (HU-50, docs/diseno/panel-evento-cinta-de-dias.md): la cinta con
 * todos los días y su estado y, debajo, el día elegido. El panel del día queda fijo y cambia lo que
 * tiene adentro: horario, personas, salones, servicios y observaciones de ese día. A la derecha, el
 * total del presupuesto y los avisos accionables de los días (conflictos y días sin cargar). Un
 * evento de un solo día muestra el mismo panel, sin la cinta.
 *
 * El horario, la distribución, las personas y los servicios de cada día se cambian en la consulta
 * («Editar en la consulta»); acá se cargan las observaciones, que son del día.
 */
export function DiasDelEvento({
  evento,
  onVerPresupuesto,
}: {
  evento: EventoDetallado;
  onVerPresupuesto?: (presupuestoId: number) => void;
}) {
  const [elegido, setElegido] = useState(0);
  const presupuesto = presupuestoVigenteDe(evento);
  // RN-12: los salones que otro evento ya ocupa. Solo mientras el evento está en consulta: uno
  // reservado ya pasó el control.
  const choques = useChoquesDeConsulta(
    evento.estado === 'EnConsulta' ? presupuesto?.id : undefined,
  );
  const porFecha = choquesPorFecha(choques.data?.choques ?? []);

  const cantidad = evento.dias.length;
  const indice = Math.min(elegido, cantidad - 1);
  const lineas = presupuesto?.lineas ?? [];
  // Una línea sin día (un presupuesto anterior a HU-50) va al primero.
  const lineasDe = (diaId: number, i: number) =>
    lineas.filter((linea) => diaDeLinea(linea) === diaId || (i === 0 && !diaDeLinea(linea)));
  const cancelado = evento.estado === 'Cancelado';

  const diasDeLaCinta: DiaDeLaCinta[] = evento.dias.map((dia, i) => {
    const fecha = dia.fecha.slice(0, 10);
    const estado = estadoDeDiaDeEvento({
      salones: dia.salones,
      lineas: lineasDe(dia.id, i).length,
      agendado: !!dia.inicio && !!dia.fin,
      conflicto: porFecha.has(fecha),
    });
    return {
      fecha,
      resumen: resumenDelDia(
        dia.salones.map((salon) => salon.nombre),
        dia.cantidadPersonas,
      ),
      estado,
      textoEstado: estado === 'pendiente' && dia.salones.length > 0 ? 'Sin horario' : undefined,
    };
  });
  const avisos = cancelado ? [] : avisosDeLosDias(diasDeLaCinta, porFecha);

  const dia = evento.dias[indice]!;
  const delDia = lineasDe(dia.id, indice);
  const subtotal = delDia.reduce((suma, linea) => suma + Number(linea.subtotal), 0);
  const hayACotizar = delDia.some((linea) => linea.aCotizar);
  const agendado = !!dia.inicio && !!dia.fin;
  const jornadaCotizada = dia.tipoJornada ?? 'completa';
  const jornadaDelDia = agendado
    ? jornadaDeHoras(horaDelEvento(dia.inicio!), horaDelEvento(dia.fin!))
    : jornadaCotizada;
  const pedido =
    dia.horaInicioEstimada || dia.horaFinEstimada
      ? textoHorarioEstimado(dia.horaInicioEstimada, dia.horaFinEstimada)
      : null;

  return (
    <div className="space-y-4">
      {cantidad > 1 && <CintaDeDias dias={diasDeLaCinta} indice={indice} onElegir={setElegido} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
        <section
          aria-label="Día elegido"
          className="min-w-0 space-y-5 rounded-xl bg-card p-5 ring-1 ring-border"
        >
          <EncabezadoDelDia fecha={dia.fecha.slice(0, 10)} indice={indice} total={cantidad}>
            {onVerPresupuesto && presupuesto && !cancelado && (
              <Button variant="outline" size="sm" onClick={() => onVerPresupuesto(presupuesto.id)}>
                <Pencil /> Editar en la consulta
              </Button>
            )}
          </EncabezadoDelDia>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DatoDelDia
              etiqueta="Horario"
              ayuda={!agendado && pedido ? `Pidió ${pedido.replace(/^D/, 'd')}` : undefined}
            >
              {agendado ? (
                `${horaDelEvento(dia.inicio!)} – ${horaDelEvento(dia.fin!)}`
              ) : (
                <span className="text-estado-consulta-texto">Sin agendar</span>
              )}
            </DatoDelDia>
            <DatoDelDia etiqueta="Personas">{dia.cantidadPersonas}</DatoDelDia>
            {/* La jornada sale del horario del día, como en la consulta. Si el presupuesto quedó
                cotizado con otra, se avisa: es lo que se cobra. */}
            <DatoDelDia
              etiqueta="Jornada"
              className="bg-dorado/15 text-dorado-texto ring-dorado/30"
              ayuda={
                jornadaCotizada !== jornadaDelDia
                  ? `Cotizada como ${nombreDeJornada(jornadaCotizada).toLowerCase()}`
                  : jornadaDelDia === 'media'
                    ? 'Hasta 4 horas'
                    : 'Más de 4 horas'
              }
            >
              {nombreDeJornada(jornadaDelDia)}
            </DatoDelDia>
            <DatoDelDia etiqueta="Salones" className="sm:col-span-2 xl:col-span-4">
              {dia.salones.length > 0 ? (
                dia.salones.map((salon, i) => (
                  <span key={salon.id}>
                    {i > 0 && ' + '}
                    {salon.nombre}
                    {salon.distribucion && (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        ({salon.distribucion.nombre.toLowerCase()})
                      </span>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-estado-consulta-texto">A definir</span>
              )}
            </DatoDelDia>
          </div>

          <div>
            <h4 className="font-semibold">Servicios y adicionales del día</h4>
            {delDia.length > 0 ? (
              <ul className="mt-1 divide-y divide-border/70 text-sm">
                {delDia.map((linea) => {
                  const aMano = linea.servicioId === null && linea.salonId === null;
                  return (
                    <li key={linea.id} className="flex justify-between gap-4 py-2.5">
                      <span className={cn('min-w-0', aMano && 'italic')}>
                        {aMano && 'Adicional a mano: '}
                        {linea.descripcion}
                        <span className="text-muted-foreground not-italic">
                          {/* La hora a la que se espera el servicio, si se pidió una. */}
                          {linea.horaEstimada && ` · ${linea.horaEstimada}`}
                          {/* RN-11: continuo o en mesa, si el servicio la lleva. */}
                          {linea.modalidad !== 'Normal' &&
                            ` · ${textoModalidad(linea.modalidad).toLowerCase()}`}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {linea.aCotizar
                          ? 'A cotizar'
                          : linea.cantidad > 1
                            ? `${linea.cantidad} × ${formateadorMoneda.format(Number(linea.precioUnitario))}`
                            : formateadorMoneda.format(Number(linea.subtotal))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                Este día no tiene nada en el presupuesto.
              </p>
            )}
            <p className="flex justify-between gap-4 border-t pt-2.5 text-sm font-medium">
              <span>Subtotal del día{hayACotizar && ' (sin lo a cotizar)'}</span>
              <span className="tabular-nums">{formateadorMoneda.format(subtotal)}</span>
            </p>
          </div>

          {/* Las observaciones son del día: cada uno arranca con su texto. */}
          <div className="[--card-spacing:0px] [&>[data-slot]]:gap-2">
            <ObservacionesDelEvento key={dia.id} evento={evento} dia={dia} integrada />
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          {presupuesto && (
            <section
              aria-label="Presupuesto"
              className="space-y-3 rounded-xl bg-card p-5 text-sm ring-1 ring-border"
            >
              <h3 className="font-heading text-base font-medium">
                Presupuesto ({presupuesto.estado})
              </h3>
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">
                  Total sin IVA{cantidad > 1 && ` · ${cantidad} días`}
                </span>
                <strong className="tabular-nums">
                  {formateadorMoneda.format(Number(presupuesto.total))}
                </strong>
              </p>
              {onVerPresupuesto && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onVerPresupuesto(presupuesto.id)}
                >
                  <FileText /> Ver detalle del presupuesto
                </Button>
              )}
              {evento.solicitud && (
                <p className="text-xs text-muted-foreground">
                  Consulta original del{' '}
                  {formateadorFecha.format(new Date(evento.solicitud.creadoEn))}
                </p>
              )}
            </section>
          )}

          <AvisosDeLosDias avisos={avisos} onVerDia={setElegido} />

          {evento.estado === 'Reservado' && (
            <section className="space-y-2 rounded-xl bg-card p-5 text-sm text-muted-foreground ring-1 ring-border">
              <h3 className="font-heading text-base font-medium text-foreground">Reserva</h3>
              {evento.senaRegistradaEn && (
                <p>
                  El salón quedó reservado el{' '}
                  {formateadorFecha.format(new Date(evento.senaRegistradaEn))}, cuando los pagos
                  alcanzaron la seña.
                </p>
              )}
              <p>
                Se puede cancelar hasta 48 horas corridas antes del inicio. El salón queda libre y
                los pagos se conservan en la cuenta: lo abonado no se reintegra.
              </p>
            </section>
          )}
          {(evento.estado === 'Cancelado' || evento.estado === 'Cobrado') && (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              Este evento está {evento.estado === 'Cancelado' ? 'cancelado' : 'cobrado'}, no admite
              más acciones.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
