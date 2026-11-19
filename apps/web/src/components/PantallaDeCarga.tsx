import { cn } from '@/lib/utils';

// El isotipo se rellena de abajo hacia arriba en bucle. La animación (`carga-relleno`) está en
// index.css y se adapta a cualquier tamaño porque recorta con clip-path en porcentajes.
function IsotipoCargando({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-block shrink-0', className)} aria-hidden>
      {/* Base: el isotipo apagado, que marca el contorno que se va a llenar. */}
      <img
        src="/confluens-isotipo.png"
        alt=""
        className="absolute inset-0 size-full opacity-15 grayscale"
      />
      {/* Relleno: el isotipo a color, revelado de abajo hacia arriba. */}
      <img
        src="/confluens-isotipo.png"
        alt=""
        className="carga-relleno absolute inset-0 size-full"
      />
    </span>
  );
}

// Pantalla de carga inicial: reemplaza a la web entera mientras se resuelve GET /auth/yo, que
// tarda más cuando la API estuvo inactiva.
export function PantallaDeCarga() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-background text-foreground"
    >
      <IsotipoCargando className="size-28" />
      <span className="sr-only">Cargando…</span>
    </main>
  );
}

// Indicador dentro de una vista, en lugar del texto suelto "Cargando…". Mantiene el texto para
// decir qué se está cargando; `className` permite adaptar el color a fondos oscuros.
export function Cargando({
  texto = 'Cargando…',
  className,
}: {
  texto?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-3 text-sm text-muted-foreground', className)}
    >
      <IsotipoCargando className="size-8" />
      <span>{texto}</span>
    </div>
  );
}
