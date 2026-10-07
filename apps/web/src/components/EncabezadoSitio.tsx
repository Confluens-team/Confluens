import type { Sesion } from '@confluens/shared';
import { ArrowLeft, LogOut, UserRound } from 'lucide-react';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

const SECCIONES = [
  { ancla: '#salones', etiqueta: 'Salones' },
  { ancla: '#gastronomia', etiqueta: 'Gastronomía' },
  { ancla: '#armado', etiqueta: 'Armado' },
  { ancla: '#condiciones', etiqueta: 'Condiciones' },
  { ancla: '#contacto', etiqueta: 'Contacto' },
] as const;

// Encabezado del canal público: lo comparten la landing y el cotizador del cliente registrado.
export function EncabezadoSitio({
  enLanding,
  sesionCliente,
  onInicio,
  onCotizar,
  onCerrarSesion,
}: {
  enLanding: boolean;
  sesionCliente: Sesion | null;
  onInicio: () => void;
  onCotizar: () => void;
  onCerrarSesion: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-papel/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <button type="button" onClick={onInicio} aria-label="Ir al inicio">
          <Logo compacto />
        </button>

        {enLanding && (
          <nav className="hidden items-center gap-6 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase lg:flex">
            {SECCIONES.map(({ ancla, etiqueta }) => (
              <a key={ancla} href={ancla} className="transition-colors hover:text-bordo">
                {etiqueta}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {sesionCliente && (
            <>
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
                <UserRound className="size-3.5" />
                {sesionCliente.email}
              </span>
              <Button variant="ghost" size="sm" onClick={onCerrarSesion}>
                <LogOut /> <span className="hidden sm:inline">Salir</span>
              </Button>
            </>
          )}
          {enLanding ? (
            <Button size="lg" className="px-4" onClick={onCotizar}>
              Cotizá<span className="hidden sm:inline"> tu evento</span>
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={onInicio}>
              <ArrowLeft /> Volver<span className="hidden sm:inline"> al sitio</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
