import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// Una hoja del presupuesto formal. En pantalla se ven apiladas, como un documento; al imprimir cada
// una ocupa un A4 entero (la página va sin márgenes: ver PresupuestoFormal) y termina con un salto.
export function HojaA4({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'mx-auto w-full max-w-[210mm] overflow-hidden bg-papel shadow-xl ring-1 ring-border',
        'print:h-[297mm] print:max-w-none print:break-after-page print:shadow-none print:ring-0',
        className,
      )}
    >
      {children}
    </section>
  );
}

// Las hojas que son iguales para todos los clientes salen del PDF que armaba Fran, como imagen.
export function HojaImagen({ src, alt }: { src: string; alt: string }) {
  return (
    <HojaA4 className="aspect-[210/297]">
      <img src={src} alt={alt} className="block size-full object-cover" />
    </HojaA4>
  );
}
