import * as React from 'react';

import { Input } from '@/components/ui/input';
import { limpiarImporte } from '@/lib/importe';
import { cn } from '@/lib/utils';

// Entrada de un importe en pesos, con el signo $ adelante para que se vea la moneda igual que en
// los importes de solo lectura (`formatearPesos`).
//
// El signo es solo visual: el valor sigue siendo el número que tipea el usuario, sin $, y lo valida
// cada formulario. `sinSigno` lo oculta cuando el campo no muestra un importe (un tercerizado «a
// cotizar»), sin correr el texto. Mismo contrato que `Input`: el `ref` y el resto de las props van
// al <input>.
//
// Antes de avisar el cambio, el texto pasa por `limpiarImporte`: así no se pueden tipear ni pegar
// letras. Se corrige `target.value`, así lo leen igual un formulario de react-hook-form (`register`)
// y uno controlado (`value` + `onChange`).
export const InputImporte = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type' | 'inputMode'> & { sinSigno?: boolean }
>(({ className, sinSigno = false, onChange, ...props }, ref) => (
  <div className="relative">
    {!sinSigno && (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground"
      >
        $
      </span>
    )}
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      className={cn('pl-6', className)}
      onChange={(evento) => {
        const limpio = limpiarImporte(evento.target.value);
        if (limpio !== evento.target.value) evento.target.value = limpio;
        onChange?.(evento);
      }}
    />
  </div>
));
InputImporte.displayName = 'InputImporte';
