import { etiquetaTipoEvento, type TipoEvento, type TipoEventoSocial } from '@confluens/shared';
import { Briefcase, PartyPopper } from 'lucide-react';

import { COLORES_TIPO_EVENTO } from '@/lib/tipo-evento';
import { cn } from '@/lib/utils';

// El ícono repite el tipo sin depender del color: se distingue también en blanco y negro.
const ICONO_TIPO_EVENTO = { Corporativo: Briefcase, Social: PartyPopper } as const;

// "Corporativo" o "Social · Casamiento", con el color y el ícono de su tipo (ADR 0008).
export function BadgeTipoEvento({
  evento,
  className,
}: {
  evento: {
    tipo: TipoEvento;
    tipoSocial?: TipoEventoSocial | null;
    tipoSocialDetalle?: string | null;
  };
  className?: string;
}) {
  const etiqueta = etiquetaTipoEvento(evento);
  const Icono = ICONO_TIPO_EVENTO[evento.tipo];
  return (
    <span
      title={etiqueta}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        COLORES_TIPO_EVENTO[evento.tipo].badge,
        className,
      )}
    >
      <Icono className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{etiqueta}</span>
    </span>
  );
}
