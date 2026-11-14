import type { EventoDetallado, TipoJornada } from '@confluens/shared';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { SelectorHora } from '@/components/SelectorFechaHora';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSalones } from '@/hooks/use-salones';
import { formatearFechaNumerica } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { CLASES_SELECT } from './clases-select';

// Un instante ISO como valor de <input type="datetime-local">, en la hora de quien lo mira.
function comoFechaHoraLocal(iso: string): string {
  const fecha = new Date(iso);
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

// Duración con la que se propone el fin a partir del inicio. Media jornada: 4 h, el máximo que
// admite (dominio.md: "hasta 4 horas inclusive"). Jornada completa: dominio.md solo dice "más de
// 4 horas"; se proponen 8 h por decisión de Franco (08/10/2026). Es una sugerencia: el fin se
// puede cambiar a mano.
const HORAS_POR_JORNADA: Record<TipoJornada, number> = { media: 4, completa: 8 };

// La jornada que eligió el cliente. Los eventos anteriores a tipoJornada no la tienen guardada:
// sale de la línea del salón del presupuesto, que es la primera ("Salón X (media jornada)").
function jornadaDelEvento(evento: EventoDetallado): TipoJornada {
  if (evento.tipoJornada) return evento.tipoJornada;
  const presupuesto = evento.presupuestos.find((p) => p.estado !== 'Cancelado');
  return presupuesto?.lineas[0]?.descripcion.endsWith('(media jornada)') ? 'media' : 'completa';
}

// "HH:mm" + horas, dando la vuelta por la medianoche ("20:00" + 8 → "04:00").
function sumarHoras(hora: string, horas: number): string {
  const [h = 0, m = 0] = hora.split(':').map(Number);
  return `${String((h + horas) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// "YYYY-MM-DD" del día siguiente, sin pasar por la zona del navegador.
function diaSiguiente(dia: string): string {
  const [a = 1970, m = 1, d = 1] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

const FORMATO_LISTA = new Intl.ListFormat('es-AR', { style: 'long', type: 'conjunction' });

// HU-50: el salón se reserva por día y su armado también, así que cada (día, salón) tiene su propia
// distribución. Es la clave de ese renglón.
const claveDeRenglon = (fecha: string, salonId: number) => `${fecha}|${salonId}`;

/**
 * Los campos del horario y de la distribución de cada salón, con su estado. Lo usan el lápiz del
 * evento (`EditorDeHorario`) y el diálogo de «Agendar y registrar pago» de una consulta, que agenda y
 * cobra de una vez (ADR 0007): los dos piden lo mismo y lo controla la misma API.
 *
 * Con varios días cada día lleva su horario y la distribución de cada uno de sus salones (el mismo
 * salón puede armarse distinto un día y otro). Devuelve los `campos` ya armados, si el horario está
 * `completo` y si `cambio` respecto de lo guardado, y `datos()` con el pedido de agendar.
 * `reiniciar()` los vuelve a lo último guardado.
 */
export function useHorarioDelEvento(evento: EventoDetallado) {
  const salones = useSalones();
  const variosDias = evento.dias.length > 1;

  // `fecha` viaja como medianoche UTC del día del evento: el día es la parte YYYY-MM-DD, sin pasar
  // por Date (que lo correría al día anterior en Argentina). Acá solo se eligen las horas: el día se
  // cambia modificando la consulta, que además recalcula el presupuesto.
  const fechaDelEvento = evento.fecha.slice(0, 10);
  const jornada = jornadaDelEvento(evento);
  const horasJornada = HORAS_POR_JORNADA[jornada];

  // La distribución de cada renglón (día, salón) del evento (ADR 0011): clave → id de la distribución,
  // '' si todavía no se eligió. Se precarga con la que cada renglón ya tiene armada.
  const distribucionesIniciales = new Map(
    evento.dias.flatMap((dia) =>
      dia.salones.map(
        (salon) =>
          [claveDeRenglon(dia.fecha, salon.id), salon.distribucion?.id.toString() ?? ''] as const,
      ),
    ),
  );
  const [distribucionPorRenglon, setDistribucionPorRenglon] = useState(distribucionesIniciales);
  function elegirDistribucion(clave: string, distribucionId: string) {
    setDistribucionPorRenglon((anteriores) => new Map(anteriores).set(clave, distribucionId));
  }
  // «Igual en todos los días»: el armado de este día para cada otro día en que se usa el salón.
  function aplicarATodosLosDias(salonId: number, distribucionId: string) {
    setDistribucionPorRenglon((anteriores) => {
      const siguientes = new Map(anteriores);
      for (const dia of evento.dias) {
        if (dia.salones.some((salon) => salon.id === salonId)) {
          siguientes.set(claveDeRenglon(dia.fecha, salonId), distribucionId);
        }
      }
      return siguientes;
    });
  }

  // Solo las horas ("HH:mm"): el día es siempre el del evento.
  const horaInicioGuardada = evento.inicio ? comoFechaHoraLocal(evento.inicio).slice(11, 16) : '';
  const horaFinGuardada = evento.fin ? comoFechaHoraLocal(evento.fin).slice(11, 16) : '';
  const [horaInicio, setHoraInicio] = useState(
    horaInicioGuardada || evento.horaInicioEstimada || '',
  );
  const [horaFin, setHoraFin] = useState(
    horaFinGuardada || (horaInicio ? sumarHoras(horaInicio, horasJornada) : ''),
  );
  // Cada vez que se elige el inicio, el fin se recalcula con la duración de la jornada. Después se
  // puede cambiar a mano; si se vuelve a tocar el inicio, se recalcula de nuevo.
  function elegirInicio(valor: string) {
    setHoraInicio(valor);
    setHoraFin(sumarHoras(valor, horasJornada));
  }

  // HU-50: un evento de varios días tiene el horario de cada día. Se precarga con lo ya agendado o, si
  // no, con la hora estimada de la consulta y el fin según la jornada de ese día.
  const horasIniciales = (): Record<string, { inicio: string; fin: string }> =>
    Object.fromEntries(
      evento.dias.map((dia) => {
        const inicioDelDia = dia.inicio
          ? comoFechaHoraLocal(dia.inicio).slice(11, 16)
          : (evento.horaInicioEstimada ?? '');
        const finDelDia = dia.fin
          ? comoFechaHoraLocal(dia.fin).slice(11, 16)
          : inicioDelDia
            ? sumarHoras(inicioDelDia, HORAS_POR_JORNADA[dia.tipoJornada ?? 'completa'])
            : '';
        return [dia.fecha, { inicio: inicioDelDia, fin: finDelDia }];
      }),
    );
  const [horasDelDia, setHorasDelDia] = useState(horasIniciales);
  function elegirInicioDelDia(fecha: string, valor: string, jornadaDelDia: TipoJornada | null) {
    setHorasDelDia((anteriores) => ({
      ...anteriores,
      [fecha]: {
        inicio: valor,
        fin: sumarHoras(valor, HORAS_POR_JORNADA[jornadaDelDia ?? 'completa']),
      },
    }));
  }
  function elegirFinDelDia(fecha: string, valor: string) {
    setHorasDelDia((anteriores) => ({
      ...anteriores,
      [fecha]: { inicio: anteriores[fecha]?.inicio ?? '', fin: valor },
    }));
  }
  // «Mismo horario que el día anterior»: copia las horas, no el día.
  function copiarHorarioDelAnterior(indice: number) {
    const anterior = evento.dias[indice - 1];
    const dia = evento.dias[indice];
    if (!anterior || !dia) return;
    setHorasDelDia((anteriores) => ({
      ...anteriores,
      [dia.fecha]: { ...anteriores[anterior.fecha]! },
    }));
  }
  // El día en que cae un instante: el fin de un día que termina pasada la medianoche es del siguiente.
  const instanteDelDia = (fecha: string, hora: string, horaDeInicio: string) =>
    `${hora < horaDeInicio ? diaSiguiente(fecha) : fecha}T${hora}`;

  // El inicio cae siempre el día del evento. Un fin más temprano que el inicio es del día
  // siguiente: el evento termina pasada la medianoche.
  const inicio = horaInicio ? `${fechaDelEvento}T${horaInicio}` : '';
  const fin = horaFin
    ? `${horaFin < horaInicio ? diaSiguiente(fechaDelEvento) : fechaDelEvento}T${horaFin}`
    : '';
  const terminaAlDiaSiguiente = horaInicio !== '' && horaFin !== '' && horaFin < horaInicio;

  // Con muchos días la ventana se hace larguísima: cada día es un renglón que se despliega. Arrancan
  // abiertos los que todavía no tienen horario o armado (o el primero, si todos lo tienen).
  const diasAbiertosIniciales = () => {
    const pendientes = evento.dias
      .filter((dia) => !dia.inicio || !dia.fin || dia.salones.some((salon) => !salon.distribucion))
      .map((dia) => dia.fecha);
    return new Set(
      pendientes.length > 0 ? pendientes : evento.dias.slice(0, 1).map((dia) => dia.fecha),
    );
  };
  const [diasAbiertos, setDiasAbiertos] = useState<Set<string>>(diasAbiertosIniciales);
  function alternarDia(fecha: string) {
    setDiasAbiertos((anteriores) => {
      const siguientes = new Set(anteriores);
      if (!siguientes.delete(fecha)) siguientes.add(fecha);
      return siguientes;
    });
  }

  // Cada renglón (día, salón) con sus distribuciones posibles y la elegida.
  const renglones = evento.dias.flatMap((dia) =>
    dia.salones.map((salonDelDia) => {
      const clave = claveDeRenglon(dia.fecha, salonDelDia.id);
      // HU-25 del Sprint 4: las dadas de baja no se ofrecen, salvo la que el renglón ya tiene, que
      // conserva (la baja no lo afecta). La API aplica la misma regla.
      const guardadaId = distribucionesIniciales.get(clave) ?? '';
      const opciones = (
        salones.data?.find((salon) => salon.id === salonDelDia.id)?.distribuciones ?? []
      ).filter((distribucion) => distribucion.activo || distribucion.id === Number(guardadaId));
      const elegidaId = distribucionPorRenglon.get(clave) ?? '';
      return {
        dia,
        salon: salonDelDia,
        clave,
        opciones,
        elegidaId,
        elegida: opciones.find((d) => d.id === Number(elegidaId)),
      };
    }),
  );
  const renglonesDe = (fecha: string) => renglones.filter((r) => r.dia.fecha === fecha);
  // Con varios salones la gente se reparte: se compara contra la capacidad sumada del día, con SU
  // armado. Es un aviso, no un tope (ADR 0011).
  const todasElegidas = renglones.length > 0 && renglones.every((r) => r.elegida !== undefined);
  const capacidadDelDia = (fecha: string) =>
    renglonesDe(fecha).reduce((suma, r) => suma + (r.elegida?.capacidad ?? 0), 0);
  const diasQueSuperan = todasElegidas
    ? evento.dias.flatMap((dia, indice) =>
        dia.cantidadPersonas > capacidadDelDia(dia.fecha) ? [{ dia, numero: indice + 1 }] : [],
      )
    : [];
  const superaCapacidad = diasQueSuperan.length > 0;

  const horarioCompleto = variosDias
    ? todasElegidas &&
      evento.dias.every((dia) => !!horasDelDia[dia.fecha]?.inicio && !!horasDelDia[dia.fecha]?.fin)
    : todasElegidas && inicio !== '' && fin !== '';
  const horarioCambio =
    renglones.some((r) => r.elegidaId !== (distribucionesIniciales.get(r.clave) ?? '')) ||
    (variosDias
      ? evento.dias.some((dia) => {
          const guardadoInicio = dia.inicio ? comoFechaHoraLocal(dia.inicio).slice(11, 16) : '';
          const guardadoFin = dia.fin ? comoFechaHoraLocal(dia.fin).slice(11, 16) : '';
          return (
            horasDelDia[dia.fecha]?.inicio !== guardadoInicio ||
            horasDelDia[dia.fecha]?.fin !== guardadoFin
          );
        })
      : inicio !== (evento.inicio ? comoFechaHoraLocal(evento.inicio) : '') ||
        fin !== (evento.fin ? comoFechaHoraLocal(evento.fin) : ''));

  // El pedido de agendar con lo que hay en los campos: una distribución por renglón, con su día.
  function datos() {
    const distribuciones = renglones.map((r) => ({
      salonId: r.salon.id,
      distribucionId: Number(r.elegidaId),
      fecha: r.dia.fecha,
    }));
    // HU-50: el horario de cada día va en `dias`; un evento de un solo día manda inicio y fin sueltos.
    const horario = variosDias
      ? {
          dias: evento.dias.map((dia) => {
            const horas = horasDelDia[dia.fecha]!;
            return {
              fecha: dia.fecha,
              inicio: new Date(instanteDelDia(dia.fecha, horas.inicio, horas.inicio)).toISOString(),
              fin: new Date(instanteDelDia(dia.fecha, horas.fin, horas.inicio)).toISOString(),
            };
          }),
        }
      : { inicio: new Date(inicio).toISOString(), fin: new Date(fin).toISOString() };
    return {
      distribuciones,
      ...horario,
      modalidadSalonRestaurante: evento.modalidadSalonRestaurante,
      // La pantalla ya avisa debajo de las distribuciones que no alcanzan: elegirlas igual es la
      // confirmación que pide la API.
      confirmarCapacidadExcedida: superaCapacidad,
    };
  }

  // Vuelve a lo último guardado: el estado se arma al montar y el evento puede haber cambiado.
  function reiniciar() {
    setDistribucionPorRenglon(new Map(distribucionesIniciales));
    setHoraInicio(horaInicioGuardada || evento.horaInicioEstimada || '');
    setHoraFin(
      horaFinGuardada ||
        (horaInicioGuardada || evento.horaInicioEstimada
          ? sumarHoras(horaInicioGuardada || evento.horaInicioEstimada || '', horasJornada)
          : ''),
    );
    setHorasDelDia(horasIniciales());
    setDiasAbiertos(diasAbiertosIniciales());
  }

  // El selector de la distribución de un renglón. Con varios días lleva el día en el id: el mismo
  // salón aparece una vez por día.
  const selectorDeDistribucion = (r: (typeof renglones)[number], etiqueta: string) => {
    const id = variosDias
      ? `distribucion-${r.dia.fecha}-${r.salon.id}`
      : `distribucion-${r.salon.id}`;
    const usos = evento.dias.filter((d) => d.salones.some((s) => s.id === r.salon.id)).length;
    return (
      <div key={r.clave} className="space-y-1.5">
        <Label htmlFor={id}>{etiqueta}</Label>
        <select
          id={id}
          className={CLASES_SELECT}
          value={r.elegidaId}
          onChange={(e) => elegirDistribucion(r.clave, e.target.value)}
        >
          <option value="">{salones.isLoading ? 'Cargando…' : 'Elegir…'}</option>
          {r.opciones.map((distribucion) => (
            <option key={distribucion.id} value={distribucion.id}>
              {distribucion.nombre} · hasta {distribucion.capacidad} personas
            </option>
          ))}
        </select>
        {/* El mismo armado en los demás días en que se usa el salón, sin elegirlo uno por uno. */}
        {variosDias && usos > 1 && r.elegidaId !== '' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2.5"
            onClick={() => aplicarATodosLosDias(r.salon.id, r.elegidaId)}
          >
            Igual en los {usos} días de {r.salon.nombre}
          </Button>
        )}
      </div>
    );
  };

  const campos =
    evento.salones.length === 0 ? (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Para cargar el horario, primero elegí el salón desde la consulta y guardá los cambios.
      </p>
    ) : (
      <div className="space-y-4">
        {/* Un evento de un solo día: una distribución por cada salón, que puede ocupar varios a la
            vez (ADR 0011). Con varios días van dentro de cada día. */}
        {!variosDias && (
          <div className="space-y-3">
            {renglones.map((r) =>
              selectorDeDistribucion(
                r,
                renglones.length === 1 ? 'Distribución' : `Distribución de ${r.salon.nombre}`,
              ),
            )}
          </div>
        )}
        {superaCapacidad && (
          <p className="text-xs text-amber-800">
            {variosDias
              ? `Superan lo que admite la distribución: ${FORMATO_LISTA.format(
                  diasQueSuperan.map(
                    ({ dia, numero }) =>
                      `el día ${numero} (${dia.cantidadPersonas} personas, admite ${capacidadDelDia(dia.fecha)})`,
                  ),
                )}`
              : `El evento es de ${evento.cantidadPersonas} personas y ${
                  renglones.length === 1
                    ? `esta distribución admite ${capacidadDelDia(fechaDelEvento)}`
                    : `estas distribuciones admiten ${capacidadDelDia(fechaDelEvento)} entre todas`
                }`}
            . Si las dejás, se agenda igual.
          </p>
        )}

        {variosDias ? (
          // HU-50: el horario y la distribución de cada día. Cada día se controla contra los eventos
          // reservados de ESE día.
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Horario y distribución de cada día{' '}
              <span className="font-normal text-muted-foreground">
                · {evento.dias.length} días, del {formatearFechaNumerica(evento.dias[0]!.fecha)} al{' '}
                {formatearFechaNumerica(evento.dias[evento.dias.length - 1]!.fecha)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Para cambiar los días, modificá la consulta: así se recalcula el presupuesto.
            </p>
            <ul className="space-y-2">
              {evento.dias.map((dia, indice) => {
                const horas = horasDelDia[dia.fecha] ?? { inicio: '', fin: '' };
                const delDia = renglonesDe(dia.fecha);
                const horarioListo = horas.inicio !== '' && horas.fin !== '';
                const armadoListo = delDia.every((r) => r.elegida !== undefined);
                const desplegado = diasAbiertos.has(dia.fecha);
                return (
                  <li key={dia.fecha} className="rounded-lg border border-border">
                    <button
                      type="button"
                      aria-expanded={desplegado}
                      onClick={() => alternarDia(dia.fecha)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">
                          Día {indice + 1} · {formatearFechaNumerica(dia.fecha)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {dia.cantidadPersonas} personas ·{' '}
                          {delDia
                            .map((r) =>
                              r.elegida
                                ? `${r.salon.nombre} (${r.elegida.nombre})`
                                : r.salon.nombre,
                            )
                            .join(', ')}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            horarioListo && armadoListo
                              ? 'text-muted-foreground'
                              : 'text-amber-800',
                          )}
                        >
                          {!horarioListo
                            ? 'Falta el horario'
                            : !armadoListo
                              ? 'Falta la distribución'
                              : `${horas.inicio} a ${horas.fin}`}
                        </span>
                        <ChevronDown
                          className={cn('size-4 transition-transform', desplegado && 'rotate-180')}
                          aria-hidden
                        />
                      </span>
                    </button>
                    {desplegado && (
                      <div className="space-y-3 border-t px-3 py-3">
                        {delDia.map((r) =>
                          selectorDeDistribucion(
                            r,
                            delDia.length === 1
                              ? 'Distribución'
                              : `Distribución de ${r.salon.nombre}`,
                          ),
                        )}
                        {indice > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="-ml-2.5"
                            onClick={() => copiarHorarioDelAnterior(indice)}
                          >
                            Mismo horario que el día {indice}
                          </Button>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`inicio-${dia.fecha}`}>Hora de inicio</Label>
                            <SelectorHora
                              id={`inicio-${dia.fecha}`}
                              value={horas.inicio}
                              onChange={(valor) =>
                                elegirInicioDelDia(dia.fecha, valor, dia.tipoJornada)
                              }
                              horaSugerida={evento.horaInicioEstimada ?? undefined}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`fin-${dia.fecha}`}>Hora de fin</Label>
                            <SelectorHora
                              id={`fin-${dia.fecha}`}
                              value={horas.fin}
                              onChange={(valor) => elegirFinDelDia(dia.fecha, valor)}
                              horaSugerida={
                                horas.inicio
                                  ? sumarHoras(
                                      horas.inicio,
                                      HORAS_POR_JORNADA[dia.tipoJornada ?? 'completa'],
                                    )
                                  : undefined
                              }
                            />
                          </div>
                        </div>
                        {horarioListo && horas.fin < horas.inicio && (
                          <p className="text-xs text-muted-foreground">Termina al día siguiente.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <>
            <p className="text-sm">
              Día del evento:{' '}
              <span className="font-medium">{formatearFechaNumerica(fechaDelEvento)}</span>
              <span className="block text-xs text-muted-foreground">
                Para cambiar el día, modificá la consulta: así se recalcula el presupuesto.
              </span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inicio">Hora de inicio</Label>
                <SelectorHora
                  id="inicio"
                  value={horaInicio}
                  onChange={elegirInicio}
                  horaSugerida={evento.horaInicioEstimada ?? undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin">Hora de fin</Label>
                <SelectorHora
                  id="fin"
                  value={horaFin}
                  onChange={setHoraFin}
                  horaSugerida={horaInicio ? sumarHoras(horaInicio, horasJornada) : undefined}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {jornada === 'media' ? 'Media jornada' : 'Jornada completa'}: el fin se calcula{' '}
              {horasJornada} h después del inicio. Podés cambiarlo.
              {terminaAlDiaSiguiente && ' Termina al día siguiente.'}
            </p>
          </>
        )}
      </div>
    );

  return { campos, completo: horarioCompleto, cambio: horarioCambio, datos, reiniciar };
}
