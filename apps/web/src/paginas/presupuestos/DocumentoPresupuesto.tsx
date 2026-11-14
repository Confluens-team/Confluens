import {
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  PORCENTAJE_SENA,
  type LineaPresupuesto,
  type TipoJornada,
} from '@confluens/shared';

import { Logo } from '@/components/Logo';
import { nombreDeJornada, resumenDeJornada, textoDePersonas } from '@/lib/dias-del-evento';
import {
  fechaLocal,
  formatearFecha,
  formatearPesos,
  nombresDeSalones,
  textoModalidad,
} from '@/lib/formato';
import { UBICACION } from '@/paginas/solicitudes/datos-institucionales';

// Un día de un evento de varios días (HU-50) con lo que se le cotizó: el documento muestra el detalle
// día por día y un único total.
export interface DiaDelDocumento {
  fecha: string; // YYYY-MM-DD
  cantidadPersonas: number;
  tipoJornada: TipoJornada;
  salones: { nombre: string }[];
  lineas: LineaPresupuesto[];
}

// El presupuesto como documento: el que ve el cliente al cotizar (PresupuestoEstimado) y el que el
// Responsable de Eventos descarga en PDF para mandárselo de manera formal (PresupuestoFormal). Se
// imprime con el diálogo del navegador; lo que no va al papel lo pone cada pantalla con
// `print:hidden`.
export function DocumentoPresupuesto({
  id,
  estado,
  emision,
  vence,
  cliente,
  fechaEvento,
  cantidadPersonas,
  salones,
  tipoJornada,
  lineas,
  dias,
  total: totalSinIva,
  salon,
  horarioDeSalones,
  sinCondiciones = false,
}: {
  id: number;
  estado: string;
  emision: Date;
  vence: Date;
  cliente: { nombre: string; correo: string; telefono: string };
  // YYYY-MM-DD, como la guarda la API.
  fechaEvento: string;
  cantidadPersonas: number;
  salones: { nombre: string }[];
  tipoJornada: TipoJornada;
  lineas: LineaPresupuesto[];
  // HU-50: con más de un día, el detalle va día por día (cada uno con su fecha, jornada, personas,
  // salones y líneas) y `lineas`, `salones`, `tipoJornada` y `cantidadPersonas` quedan de resumen.
  dias?: DiaDelDocumento[];
  // Sin IVA, como se guarda (RN-05): es el subtotal del desglose.
  total: string;
  // El horario que va en la línea del salón (la de `idLinea`), en el presupuesto formal.
  salon?: { idLinea: number; horario: string };
  // HU-50: con varios días, el mismo horario (el estimado, mientras no se agende) en cada línea de salón.
  horarioDeSalones?: string;
  // El presupuesto formal trae después las condiciones completas: no hace falta el resumen.
  sinCondiciones?: boolean;
}) {
  const { subtotal, iva, total } = desglosarIva(totalSinIva);
  const numero = String(id).padStart(6, '0');
  const variosDias = dias !== undefined && dias.length > 1;
  const jornadas = resumenDeJornada(dias?.map((dia) => dia.tipoJornada) ?? []);
  const salonesDelEvento = variosDias
    ? [
        ...new Map(
          dias.flatMap((dia) => dia.salones).map((salon) => [salon.nombre, salon]),
        ).values(),
      ]
    : salones;

  const filasDe = (delDia: LineaPresupuesto[]) =>
    delDia.map((linea) => (
      <tr key={linea.id}>
        <td className="py-3 pr-3">
          {linea.descripcion}
          {/* RN-11: la modalidad elegida, con su recargo ya sumado al unitario. */}
          {linea.modalidad !== 'Normal' && (
            <span className="block text-xs text-muted-foreground">
              {textoModalidad(linea.modalidad)}
            </span>
          )}
          {/* La hora a la que se espera el servicio, si se pidió una. */}
          {linea.horaEstimada && (
            <span className="ml-2 text-xs whitespace-nowrap text-muted-foreground">
              a las {linea.horaEstimada}
            </span>
          )}
          {salon?.idLinea === linea.id && (
            <span className="block text-xs text-muted-foreground">{salon.horario}</span>
          )}
          {horarioDeSalones && linea.salonId !== null && (
            <span className="block text-xs text-muted-foreground">{horarioDeSalones}</span>
          )}
        </td>
        <td className="py-3 text-right tabular-nums">{linea.cantidad}</td>
        <td className="hidden py-3 text-right tabular-nums sm:table-cell">
          {linea.aCotizar ? '—' : formatearPesos(linea.precioUnitario)}
        </td>
        <td className="py-3 text-right font-medium tabular-nums">
          {/* HU-11: un tercerizado sin precio fijo va sin importe y no suma. */}
          {linea.aCotizar ? 'A cotizar' : formatearPesos(linea.subtotal)}
        </td>
      </tr>
    ));

  return (
    <article className="relative rounded-sm bg-papel p-8 shadow-xl ring-1 ring-border sm:p-12 print:shadow-none print:ring-0">
      <div
        className="pointer-events-none absolute inset-3 rounded-sm border border-dorado/40"
        aria-hidden
      />

      <header className="relative flex flex-col gap-6 border-b border-dorado/40 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Logo />
          <p className="mt-4 text-xs text-muted-foreground">
            Hotel Dr. César Carman · {UBICACION.direccion}, {UBICACION.localidad}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold tracking-[0.25em] text-dorado-texto uppercase">
            Presupuesto estimado
          </p>
          <p className="mt-1 font-serif text-2xl font-semibold text-bordo">N° {numero}</p>
          <p className="mt-2 text-xs text-muted-foreground">Emitido el {formatearFecha(emision)}</p>
          <p className="text-xs text-muted-foreground">Válido hasta el {formatearFecha(vence)}</p>
          <span className="mt-3 inline-block rounded-full bg-dorado/20 px-3 py-0.5 text-xs font-semibold text-bordo">
            {estado}
          </span>
        </div>
      </header>

      <section className="relative grid gap-6 py-8 sm:grid-cols-2">
        <div>
          <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Cliente
          </p>
          <p className="mt-2 font-medium">{cliente.nombre}</p>
          <p className="text-sm text-muted-foreground">{cliente.correo}</p>
          <p className="text-sm text-muted-foreground">{cliente.telefono}</p>
        </div>
        <div>
          <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Evento
          </p>
          {variosDias ? (
            <p className="mt-2 font-medium">
              Del {formatearFecha(fechaLocal(dias[0]!.fecha))} al{' '}
              {formatearFecha(fechaLocal(dias[dias.length - 1]!.fecha))} · {dias.length} días
            </p>
          ) : (
            <p className="mt-2 font-medium first-letter:uppercase">
              {formatearFecha(fechaLocal(fechaEvento), true)}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {salonesDelEvento.length === 1 ? 'Salón' : 'Salones'}{' '}
            {nombresDeSalones(salonesDelEvento)} ·{' '}
            {variosDias ? jornadas.texto : nombreDeJornada(tipoJornada)}
          </p>
          <p className="text-sm text-muted-foreground">
            {variosDias
              ? textoDePersonas(dias.map((dia) => dia.cantidadPersonas))
              : `${cantidadPersonas} personas`}
          </p>
        </div>
      </section>

      <table className="relative w-full text-sm">
        <thead>
          <tr className="border-y border-bordo/20 text-left text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase">
            <th className="py-3 font-semibold">Concepto</th>
            <th className="py-3 text-right font-semibold">Cant.</th>
            <th className="hidden py-3 text-right font-semibold sm:table-cell">Precio unitario</th>
            <th className="py-3 text-right font-semibold">Subtotal</th>
          </tr>
        </thead>
        {variosDias ? (
          // HU-50: un bloque por día, con su encabezado y su subtotal, y un único total abajo.
          dias.map((dia, i) => {
            const delDia = dia.lineas.reduce(
              (suma, linea) => suma + (linea.aCotizar ? 0 : Number(linea.subtotal)),
              0,
            );
            return (
              <tbody key={dia.fecha} className="divide-y divide-border">
                <tr className="bg-bordo/5">
                  <th colSpan={4} className="px-2 py-2 text-left text-xs font-semibold text-bordo">
                    Día {i + 1} ·{' '}
                    <span className="first-letter:uppercase">
                      {formatearFecha(fechaLocal(dia.fecha), true)}
                    </span>
                    <span className="ml-2 font-normal text-muted-foreground">
                      {nombresDeSalones(dia.salones)} · {nombreDeJornada(dia.tipoJornada)} ·{' '}
                      {dia.cantidadPersonas} personas
                    </span>
                  </th>
                </tr>
                {filasDe(dia.lineas)}
                <tr>
                  <td colSpan={3} className="py-2 text-right text-xs text-muted-foreground">
                    Subtotal del día {i + 1}
                  </td>
                  <td className="py-2 text-right text-sm font-medium tabular-nums">
                    {formatearPesos(delDia.toFixed(2))}
                  </td>
                </tr>
              </tbody>
            );
          })
        ) : (
          <tbody className="divide-y divide-border">{filasDe(lineas)}</tbody>
        )}
      </table>

      {/* RN-05: subtotal sin IVA, IVA 21% sobre ese subtotal y total. */}
      <dl className="relative mt-6 ml-auto flex w-full max-w-xs flex-col gap-2 border-t-2 border-bordo pt-4 text-sm">
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">Subtotal sin IVA</dt>
          <dd className="font-medium tabular-nums">{formatearPesos(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">IVA 21%</dt>
          <dd className="font-medium tabular-nums">{formatearPesos(iva)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-6 border-t border-border pt-2">
          <dt className="font-semibold">Total</dt>
          <dd className="font-serif text-3xl font-semibold text-bordo tabular-nums">
            {formatearPesos(total)}
          </dd>
        </div>
      </dl>
      <p className="relative mt-4 text-right text-sm font-medium text-bordo">
        Este presupuesto tiene una validez de {DIAS_VIGENCIA_PRESUPUESTO} días.
      </p>

      {!sinCondiciones && (
        <footer className="relative mt-10 rounded-lg bg-muted/70 p-5 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">Condiciones</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              Presupuesto estimado sujeto a disponibilidad del salón en la fecha elegida: no reserva
              la fecha hasta que se confirme.
            </li>
            <li>
              La seña del {PORCENTAJE_SENA}% se abona dentro de la vigencia del presupuesto y
              congela sus precios. Se calcula sobre el total con IVA.
            </li>
            <li>
              Vencidos los {DIAS_VIGENCIA_PRESUPUESTO} días sin seña, el presupuesto se recalcula
              con los precios vigentes.
            </li>
            <li>Cancelación hasta 48 horas corridas antes del evento. La seña no se reintegra.</li>
          </ul>
        </footer>
      )}
    </article>
  );
}
