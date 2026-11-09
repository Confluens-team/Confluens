import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Campo de contraseña con un botón para verla u ocultarla mientras se escribe, para que quien
// completa el formulario pueda revisar lo que tipeó (en el celular, sobre todo).
//
// Mismo contrato que `Input`: el `ref` y el resto de las props (los de `register()` de
// react-hook-form, `aria-*`, `autoComplete`, `className`) van al <input>. Cambia solo el `type`
// entre "password" y "text"; el valor lo sigue manejando el formulario, así que no se pierde al
// alternar. El botón es de tipo `button` para no enviar el formulario y anuncia su estado con
// `aria-pressed`. Arranca oculta y vuelve a ocultarse al montarse de nuevo, nunca se recuerda.
export const InputContrasena = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type'>
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', className)}
      />
      {/* 44 px de ancho, el mínimo táctil de WCAG 2.5.5, y de alto el del campo. */}
      <button
        type="button"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        onClick={() => setVisible((actual) => !actual)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {visible ? (
          <EyeOff aria-hidden className="size-4" />
        ) : (
          <Eye aria-hidden className="size-4" />
        )}
      </button>
    </div>
  );
});
InputContrasena.displayName = 'InputContrasena';
