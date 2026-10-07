import { cn } from '@/lib/utils';

// Isotipo "LA" del tarifario del cliente: círculo bordó con las iniciales en serif.
export function Logo({
  className,
  claro = false,
  compacto = false,
}: {
  className?: string;
  claro?: boolean;
  // En pantallas chicas deja solo el isotipo (lo usa el encabezado).
  compacto?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-full font-serif text-lg font-semibold tracking-tight shadow-sm',
          claro
            ? 'bg-crema text-bordo ring-1 ring-dorado/60'
            : 'bg-gradient-to-br from-bordo to-bordo-oscuro text-crema ring-1 ring-dorado/40',
        )}
        aria-hidden
      >
        LA
      </span>
      <span className={cn('flex-col leading-none', compacto ? 'hidden sm:flex' : 'flex')}>
        <span
          className={cn(
            'font-serif text-lg font-semibold tracking-[0.12em] whitespace-nowrap',
            claro ? 'text-crema' : 'text-bordo',
          )}
        >
          LOS ABUELOS
        </span>
        <span
          className={cn(
            'mt-1 text-[0.6rem] font-medium tracking-[0.22em] whitespace-nowrap uppercase',
            claro ? 'text-crema/70' : 'text-muted-foreground',
          )}
        >
          Servicios gastronómicos
        </span>
      </span>
    </span>
  );
}
