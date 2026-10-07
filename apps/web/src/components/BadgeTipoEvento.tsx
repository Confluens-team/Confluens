import { etiquetaTipoEvento, type TipoEvento, type TipoEventoSocial } from '@confluens/shared';

import { COLORES_TIPO_EVENTO } from '@/lib/tipo-evento';
import { cn } from '@/lib/utils';

// "Corporativo" o "Social · Casamiento", con el color de su tipo (ADR 0008).
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
  return (
    <span
      title={etiqueta}
      className={cn(
        'inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
        COLORES_TIPO_EVENTO[evento.tipo].badge,
        className,
      )}
    >
      {etiqueta}
    </span>
  );
}
