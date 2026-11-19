import { ConfluensMarca } from '@/components/ConfluensMarca';
import { cn } from '@/lib/utils';

// Marca de Confluens para el panel interno: isotipo y nombre, con el mismo tamaño y tipografía que
// el Logo de Los Abuelos del sitio público, que sigue siendo lo que ve el cliente.
export function LogoConfluens({
  className,
  compacto = false,
}: {
  className?: string;
  // En pantallas chicas deja solo el isotipo (lo usa el encabezado).
  compacto?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <ConfluensMarca className="size-11 shrink-0" />
      <span className={cn('flex-col leading-none', compacto ? 'hidden sm:flex' : 'flex')}>
        <span className="font-serif text-lg font-semibold tracking-[0.12em] whitespace-nowrap text-bordo">
          CONFLUENS
        </span>
        <span className="mt-1 text-[0.6rem] font-medium tracking-[0.22em] whitespace-nowrap text-muted-foreground uppercase">
          Gestión de eventos
        </span>
      </span>
    </span>
  );
}
