import { Copy } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';

import { buttonVariants } from '@/components/ui/button';

export interface OpcionDeCopia {
  indice: number;
  // «Día 1 · jue 10/12»
  titulo: string;
  // «200 personas · Auditorio + Pucará · 09:00 a 18:00»
  detalle: string;
}

/**
 * «Copiar día cargado» (HU-50): abre la lista de los otros días ya completos y copia el elegido en
 * este. Se copia todo lo del día (personas, horario, salones y gastronomía), y después se cambia
 * solo lo distinto. Sin días cargados para copiar, el botón queda deshabilitado.
 */
export function CopiarDiaCargado({
  opciones,
  onCopiar,
  variante = 'outline',
}: {
  opciones: OpcionDeCopia[];
  onCopiar: (indice: number) => void;
  variante?: 'outline' | 'ghost';
}) {
  const [abierto, setAbierto] = useState(false);
  const sinOpciones = opciones.length === 0;

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      {/* Un <button> propio con el estilo de Button: el popover necesita la ref del disparador
          para ubicarse, y Button no la reenvía. */}
      <Popover.Trigger
        type="button"
        disabled={sinOpciones}
        title={sinOpciones ? 'Todavía no hay días cargados para copiar' : undefined}
        className={buttonVariants({ variant: variante })}
      >
        <Copy /> Copiar día cargado
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-72 rounded-xl bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-border"
        >
          <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
            ¿Qué día querés copiar?
          </p>
          <ul className="space-y-1">
            {opciones.map((opcion) => (
              <li key={opcion.indice}>
                <button
                  type="button"
                  onClick={() => {
                    onCopiar(opcion.indice);
                    setAbierto(false);
                  }}
                  className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="block text-sm font-semibold text-bordo capitalize">
                    {opcion.titulo}
                  </span>
                  <span className="block text-xs text-muted-foreground">{opcion.detalle}</span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
