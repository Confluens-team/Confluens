import { MODALIDADES_SERVICIO, type ModalidadServicio } from '@confluens/shared';

import { textoModalidad } from '@/lib/formato';
import { cn } from '@/lib/utils';

// RN-11: normal, continuo en salón (+20%) o en mesas con mozo (+30%). Solo se muestra en los
// servicios que la admiten (hoy, los coffee breaks); una sola por servicio mientras S-09 siga
// abierto. Lo usan el cotizador del cliente y el editor del presupuesto.
export function SelectorModalidad({
  id,
  value,
  onChange,
  className,
  disabled,
}: {
  id: string;
  value: ModalidadServicio;
  onChange: (modalidad: ModalidadServicio) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      aria-label="Modalidad del servicio"
      className={cn(
        'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-60',
        className,
      )}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ModalidadServicio)}
    >
      {MODALIDADES_SERVICIO.map((modalidad) => (
        <option key={modalidad} value={modalidad}>
          {textoModalidad(modalidad)}
        </option>
      ))}
    </select>
  );
}
