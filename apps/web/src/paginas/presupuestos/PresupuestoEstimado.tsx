import { DIAS_VIGENCIA_PRESUPUESTO, desglosarIva, PORCENTAJE_SENA } from '@confluens/shared';
import { CheckCircle2, Home, Printer, RotateCcw } from 'lucide-react';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { fechaLocal, formatearFecha, formatearPesos } from '@/lib/formato';
import { UBICACION } from '@/paginas/solicitudes/datos-institucionales';
import type { PresupuestoGenerado } from './CotizarEvento';

// Presupuesto Estimado recién generado, presentado como el documento que hoy el cliente recibe en
// PDF por WhatsApp. "Imprimir" usa el diálogo del navegador, que permite guardarlo como PDF.
export function PresupuestoEstimado({
  resultado,
  onOtro,
  onInicio,
}: {
  resultado: PresupuestoGenerado;
  onOtro: () => void;
  onInicio: () => void;
}) {
  const { presupuesto, salon, tipoJornada, cliente } = resultado;
  const emision = new Date(presupuesto.fechaEmision);
  const vence = new Date(emision);
  vence.setDate(vence.getDate() + DIAS_VIGENCIA_PRESUPUESTO);
  // presupuesto.total se guarda sin IVA (RN-05): es el subtotal del desglose.
  const { subtotal, iva, total } = desglosarIva(presupuesto.total);
  const numero = String(presupuesto.id).padStart(6, '0');

  return (
    <main className="fondo-papel min-h-screen px-4 py-10 sm:px-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50 px-5 py-4 text-emerald-900 ring-1 ring-emerald-200 print:hidden">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">¡Listo! Generamos tu presupuesto estimado.</p>
            <p>
              Un responsable de eventos va a revisar la disponibilidad del salón y se va a comunicar
              con vos al {cliente.telefono}.
            </p>
          </div>
        </div>

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
              <p className="mt-2 text-xs text-muted-foreground">
                Emitido el {formatearFecha(emision)}
              </p>
              <p className="text-xs text-muted-foreground">
                Válido hasta el {formatearFecha(vence)}
              </p>
              <span className="mt-3 inline-block rounded-full bg-dorado/20 px-3 py-0.5 text-xs font-semibold text-bordo">
                {presupuesto.estado}
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
                {formatearFecha(fechaLocal(presupuesto.evento.fecha), true)}
              </p>
              <p className="text-sm text-muted-foreground">
                Salón {salon.nombre} ·{' '}
                {tipoJornada === 'completa' ? 'Jornada completa' : 'Media jornada'}
              </p>
              <p className="text-sm text-muted-foreground">
                {presupuesto.evento.cantidadPersonas} personas
              </p>
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
              {presupuesto.lineas.map((linea) => (
                <tr key={linea.id}>
                  <td className="py-3 pr-3">{linea.descripcion}</td>
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
                Presupuesto estimado sujeto a disponibilidad del salón en la fecha elegida: no
                reserva la fecha hasta que se confirme.
              </li>
              <li>
                La seña del {PORCENTAJE_SENA}% se abona dentro de la vigencia del presupuesto y
                congela sus precios. Se calcula sobre el total con IVA.
              </li>
              <li>
                Vencidos los {DIAS_VIGENCIA_PRESUPUESTO} días sin seña, el presupuesto se recalcula
                con los precios vigentes.
              </li>
              <li>
                Cancelación hasta 48 horas corridas antes del evento. La seña no se reintegra.
              </li>
            </ul>
          </footer>
        </article>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row print:hidden">
          <Button size="lg" className="h-11" onClick={() => window.print()}>
            <Printer /> Imprimir o guardar PDF
          </Button>
          <Button size="lg" variant="outline" className="h-11" onClick={onOtro}>
            <RotateCcw /> Armar otro presupuesto
          </Button>
          <Button size="lg" variant="ghost" className="h-11" onClick={onInicio}>
            <Home /> Volver al sitio
          </Button>
        </div>
      </div>
    </main>
  );
}
