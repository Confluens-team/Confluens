import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Entrada de un importe en pesos, con el signo $ adelante para que se vea la moneda igual que en
// los importes de solo lectura (`formatearPesos`).
//
// El signo es solo visual: el valor sigue siendo el número que tipea el usuario, sin $, y lo valida
// cada formulario. `sinSigno` lo oculta cuando el campo no muestra un importe (un tercerizado «a
// cotizar»), sin correr el texto. Mismo contrato que `Input`: el `ref` y el resto de las props van
// al <input>.
export const InputImporte = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type' | 'inputMode'> & { sinSigno?: boolean }
>(({ className, sinSigno = false, ...props }, ref) => (
  <div className="relative">
    {!sinSigno && (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
      >
        $
      </span>
    )}
    <Input {...props} ref={ref} type="text" inputMode="decimal" className={cn('pl-6', className)} />
  </div>
));
InputImporte.displayName = 'InputImporte';
