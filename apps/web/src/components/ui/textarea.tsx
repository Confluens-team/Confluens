import * as React from 'react';
import { cn } from 'cn';

// Mismo problema (y misma solución) que en input.tsx: la plantilla de shadcn asume React 19, donde
// `ref` es una prop común de los componentes de función. Con React 18.3.1 el ref que pasa
// react-hook-form vía `register()` se pierde en silencio, el campo nunca se conecta y el valor
// tipeado no llega al submit. Se detectó al cargar la observación de un pago en CuentaDelEvento.tsx:
// el textarea tenía texto, pero la API recibía `observacion` vacío.
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        data-slot="textarea"
        ref={ref}
        className={cn(
          'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
