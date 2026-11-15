import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatearPesos } from '@/lib/formato';
import { cn } from '@/lib/utils';

const formateadorDiaSemana = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  timeZone: 'UTC',
});
const formateadorFechaLarga = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const enUTC = (fecha: string) => new Date(`${fecha}T00:00:00Z`);

// La fecha grande de la tarjeta: «JUE» arriba y «10» abajo.
function FechaGrande({ fecha }: { fecha: string }) {
  return (
    <div className="w-12 shrink-0 text-center sm:w-14">
      <span className="block text-[0.65rem] font-semibold tracking-[0.12em] text-dorado-texto uppercase">
        {formateadorDiaSemana.format(enUTC(fecha)).replace('.', '')}
      </span>
      <b className="block font-serif text-2xl leading-tight text-bordo">{Number(fecha.slice(8))}</b>
    </div>
  );
}

export type EstadoDeTarjeta = 'abierta' | 'completa' | 'incompleta' | 'sinCargar';

/**
 * Un día del evento como tarjeta (HU-50, diseño «cotizador con tarjetas por día»):
 * - abierta: el editor del día (`children`), con «Copiar día cargado» arriba y el subtotal y
 *   «Listo» al pie. Una sola a la vez.
 * - completa: resumida en chips, con su subtotal y «Editar».
 * - incompleta: empezada pero sin terminar, con «Seguir cargando».
 * - sinCargar: borde punteado, con «Copiar día cargado» y «Cargar».
 * Con errores al enviar, la tarjeta se marca y avisa qué falta.
 */
export function TarjetaDia({
  numero,
  fecha,
  estado,
  resumen,
  subtotal,
  error,
  copiar,
  textoListo,
  onAbrir,
  onListo,
  children,
}: {
  numero: number;
  fecha: string;
  estado: EstadoDeTarjeta;
  resumen: string[];
  subtotal: number;
  error?: string;
  copiar: React.ReactNode;
  textoListo: string;
  onAbrir: () => void;
  onListo: () => void;
  children: React.ReactNode;
}) {
  const conError = !!error;

  if (estado === 'abierta') {
    return (
      <article
        className={cn(
          'rounded-2xl border-2 bg-card shadow-[0_6px_18px_rgba(94,31,26,0.08)]',
          conError ? 'border-destructive' : 'border-bordo',
        )}
        aria-label={`Día ${numero}`}
      >
        <header className="flex flex-wrap items-center gap-4 border-b border-dashed border-border px-4 py-4 sm:px-5">
          <FechaGrande fecha={fecha} />
          <div className="min-w-0 flex-1">
            <strong className="block text-[15px]">
              Día {numero} · <span>{formateadorFechaLarga.format(enUTC(fecha))}</span>
            </strong>
            <span className="text-xs text-muted-foreground">Editando</span>
          </div>
          {copiar}
        </header>
        <div className="flex flex-col gap-6 p-4 sm:p-5">
          {/* Abierta, cada campo muestra su propio error: la tarjeta solo marca el borde. */}
          {children}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-4">
            <span className="text-sm">
              Subtotal del día: <strong className="tabular-nums">{formatearPesos(subtotal)}</strong>{' '}
              <span className="text-xs text-muted-foreground">sin IVA</span>
            </span>
            <Button type="button" className="h-11 px-5" onClick={onListo}>
              {textoListo}
            </Button>
          </div>
        </div>
      </article>
    );
  }

  const sinCargar = estado === 'sinCargar';
  return (
    <article
      className={cn(
        'rounded-2xl border bg-card',
        sinCargar && 'border-dashed',
        conError ? 'border-2 border-destructive' : 'border-border',
      )}
      aria-label={`Día ${numero}`}
    >
      <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
        <FechaGrande fecha={fecha} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <strong className="text-[15px]">Día {numero}</strong>
            {estado === 'completa' && (
              <span className="rounded-full bg-estado-confirmado-fondo px-2.5 py-0.5 text-xs font-medium text-estado-confirmado">
                Completo
              </span>
            )}
            {estado === 'incompleta' && (
              <span className="rounded-full bg-estado-expirado-fondo px-2.5 py-0.5 text-xs font-medium text-estado-expirado-texto">
                Falta completar
              </span>
            )}
            {sinCargar && (
              <span className="rounded-full bg-estado-expirado-fondo px-2.5 py-0.5 text-xs font-medium text-estado-expirado-texto">
                Sin cargar
              </span>
            )}
          </div>
          {sinCargar ? (
            <span className="text-xs text-muted-foreground">
              Podés copiar un día que ya cargaste y cambiar solo lo distinto.
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {resumen.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          {conError && <p className="text-xs text-destructive">{error}</p>}
        </div>
        {!sinCargar && (
          <div className="text-right">
            <strong className="block text-[15px] tabular-nums">{formatearPesos(subtotal)}</strong>
            <span className="text-xs text-muted-foreground">sin IVA</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {sinCargar && copiar}
          <Button type="button" variant={sinCargar ? 'default' : 'outline'} onClick={onAbrir}>
            {sinCargar ? (
              'Cargar'
            ) : (
              <>
                <Pencil /> {estado === 'incompleta' ? 'Seguir cargando' : 'Editar'}
              </>
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}
