import * as React from 'react';
import { cn } from 'cn';

// La plantilla que trae `npx shadcn add input` no envuelve esto en
// React.forwardRef porque el registry asume React 19 (donde `ref` ya es una
// prop común en componentes de función). Este proyecto está en React 18.3.1
// (ver AGENTS.md/stack), donde sin forwardRef el `ref` que pasa
// react-hook-form vía `register()` se pierde en silencio: React tira el
// warning "Function components cannot be given refs" y el input queda sin
// conectar al ref interno de RHF. Se detectó al verificar visualmente
// IniciarSesion.tsx con las herramientas de Chrome.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        ref={ref}
        className={cn(
          'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
