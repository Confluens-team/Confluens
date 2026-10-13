import * as React from 'react';

import { Input } from '@/components/ui/input';

// Entrada de una cantidad entera (personas, unidades de un servicio).
//
// No usa `type="number"`: ese input deja tipear `e`, `+`, `-`, `,` y `.` —son caracteres válidos
// para un número en notación científica o decimal— y cuando lo que quedó no es un número válido el
// navegador devuelve string vacío en `e.target.value`. El formulario entonces no puede explicar
// nada: no recibe "2,5" para rechazarlo, recibe "" y el campo parece vacío. Acá el valor es texto
// filtrado a dígitos, así que el estado inválido no llega a existir y no hay error que mostrar.
//
// `max` recorta en el momento. Es para topes que son un hecho del evento (no se puede servir un
// coffee a más personas que las que asisten) y no una preferencia a discutir con el usuario.
export const InputEntero = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'max' | 'min'> & {
    max?: number;
    onChangeValor: (valor: string) => void;
  }
>(({ max, onChangeValor, ...props }, ref) => (
  <Input
    {...props}
    ref={ref}
    type="text"
    inputMode="numeric"
    onChange={(evento) => {
      // Sin ceros a la izquierda: "007" queda "7" y "0" solo (que no es una cantidad válida) queda
      // vacío, que es lo que los formularios ya tratan como "sin completar".
      const digitos = evento.target.value.replace(/\D/g, '').replace(/^0+/, '');
      onChangeValor(
        max !== undefined && digitos !== '' ? String(Math.min(Number(digitos), max)) : digitos,
      );
    }}
  />
));
InputEntero.displayName = 'InputEntero';
