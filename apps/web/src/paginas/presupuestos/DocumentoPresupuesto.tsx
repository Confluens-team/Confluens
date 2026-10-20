import {
  DIAS_VIGENCIA_PRESUPUESTO,
  desglosarIva,
  PORCENTAJE_SENA,
  type LineaPresupuesto,
  type TipoJornada,
} from '@confluens/shared';

import { Logo } from '@/components/Logo';
import {
  fechaLocal,
  formatearFecha,
  formatearPesos,
  nombresDeSalones,
  textoModalidad,
} from '@/lib/formato';
import { UBICACION } from '@/paginas/solicitudes/datos-institucionales';

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
  total: totalSinIva,
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
  // Sin IVA, como se guarda (RN-05): es el subtotal del desglose.
  total: string;
}) {
  const { subtotal, iva, total } = desglosarIva(totalSinIva);
  const numero = String(id).padStart(6, '0');

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
          <p className="mt-2 font-medium first-letter:uppercase">
            {formatearFecha(fechaLocal(fechaEvento), true)}
          </p>
          <p className="text-sm text-muted-foreground">
            {salones.length === 1 ? 'Salón' : 'Salones'} {nombresDeSalones(salones)} ·{' '}
            {tipoJornada === 'completa' ? 'Jornada completa' : 'Media jornada'}
          </p>
          <p className="text-sm text-muted-foreground">{cantidadPersonas} personas</p>
        </div>
      </section>

      <table className="relative w-full text-sm">
        <thead>
          <tr className="border-y border-bordo/20 text-left text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase">
            <th className="py-3 font-semibold">Concepto</th>
            <th className="py-3 text-right font-semibold">Cant.</th>
            <th className="hidden py-3 text-right font-semibold sm:table-cell">Unitario</th>
            <th className="py-3 text-right font-semibold">Subtotal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lineas.map((linea) => (
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
          ))}
        </tbody>
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

      <footer className="relative mt-10 rounded-lg bg-muted/70 p-5 text-xs leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">Condiciones</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            Presupuesto estimado sujeto a disponibilidad del salón en la fecha elegida: no reserva
            la fecha hasta que se confirme.
          </li>
          <li>
            La seña del {PORCENTAJE_SENA}% se abona dentro de la vigencia del presupuesto y congela
            sus precios. Se calcula sobre el total con IVA.
          </li>
          <li>
            Vencidos los {DIAS_VIGENCIA_PRESUPUESTO} días sin seña, el presupuesto se recalcula con
            los precios vigentes.
          </li>
          <li>Cancelación hasta 48 horas corridas antes del evento. La seña no se reintegra.</li>
        </ul>
      </footer>
    </article>
  );
}
