import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';

// Ventana para los formularios de alta del catálogo (servicios, incremento mensual y medios de
// pago): cada pantalla muestra un botón y el formulario se abre acá, sobre el listado. Mismo
// estilo que la ventana de ReutilizarConfiguracion.
export function VentanaFormulario({
  abierto,
  onCambiarAbierto,
  titulo,
  descripcion,
  children,
}: {
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={abierto} onOpenChange={onCambiarAbierto}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bordo-oscuro/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-papel p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-heading text-lg font-medium">{titulo}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {descripcion}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
