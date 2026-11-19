import { EtiquetaCliente } from '@/components/EtiquetaCliente';
import { cn } from '@/lib/utils';

/**
 * Los datos del cliente de una consulta o un evento, con las acciones a la derecha (15/11/2026):
 * queda visible en todas las pestañas del detalle, menos en Historial.
 */
export function TarjetaCliente({
  nombre,
  correo,
  telefono,
  etiqueta,
  nota,
  children,
  className,
}: {
  nombre: string;
  correo: string;
  telefono: string;
  etiqueta: React.ComponentProps<typeof EtiquetaCliente>['etiqueta'];
  nota?: string;
  // Las acciones: van a la derecha y bajan debajo de los datos en pantallas angostas.
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label="Cliente"
      className={cn('rounded-xl bg-card p-5 ring-1 ring-border', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h3 className="text-[0.65rem] font-semibold tracking-[0.15em] text-dorado-texto uppercase">
            Cliente
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-medium">
            {nombre}
            <EtiquetaCliente etiqueta={etiqueta} />
          </p>
          <p className="text-sm break-words text-muted-foreground">
            {correo} · {telefono}
          </p>
          {nota && <p className="mt-2 text-xs text-muted-foreground">{nota}</p>}
        </div>
        {children && <div className="flex flex-col items-end gap-3">{children}</div>}
      </div>
    </section>
  );
}
