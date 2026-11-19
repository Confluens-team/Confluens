import type { RegistroAuditoria, Rol, TipoDeAccion } from '@confluens/shared';
import { ArrowRight, Check, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useEsGerente, useMarcarRevisado } from '@/hooks/use-auditoria';
import { ErrorApiCliente } from '@/lib/api';
import { formatearFechaHora, formatearValor, inicialesDe, nombreDeCampo } from '@/lib/auditoria';
import { cn } from '@/lib/utils';

// Piezas de la Auditoría para Gerencia (diseños A, B y D, 15/11/2026), con la paleta del panel.

// El color del círculo de cada usuario sale de su rol: se reconoce de un vistazo quién hizo qué.
const COLOR_DE_ROL: Record<Rol | 'SISTEMA', string> = {
  GERENTE_GENERAL: 'bg-bordo text-crema',
  ADMINISTRADOR_SISTEMA: 'bg-estado-cobrado text-white',
  RESPONSABLE_EVENTOS: 'bg-dorado-texto text-white',
  RESPONSABLE_FINANZAS: 'bg-estado-confirmado text-white',
  CLIENTE: 'bg-estado-cancelado text-white',
  SISTEMA: 'bg-estado-cancelado text-white',
};

export function Inicial({
  usuario,
  className,
}: {
  usuario: { email: string; rol?: Rol } | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold',
        COLOR_DE_ROL[usuario?.rol ?? 'SISTEMA'],
        className,
      )}
    >
      {inicialesDe(usuario?.email)}
    </span>
  );
}

const ESTILO_DE_ACCION: Record<TipoDeAccion, { texto: string; clase: string }> = {
  alta: {
    texto: 'Alta',
    clase: 'bg-estado-confirmado-fondo text-estado-confirmado-texto',
  },
  modificacion: { texto: 'Modificación', clase: 'bg-secondary text-bordo' },
  baja: { texto: 'Baja', clase: 'bg-estado-expirado-fondo text-estado-expirado-texto' },
};

export function ChipAccion({ tipo }: { tipo: TipoDeAccion }) {
  const { texto, clase } = ESTILO_DE_ACCION[tipo];
  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', clase)}>
      {texto}
    </span>
  );
}

/**
 * Sensible, y en qué quedó: «Revisado» si el GG ya lo vio, «Gerencia» si lo hizo él (no se
 * revisa) o «Sensible» a secas si espera la revisión. Nada si no es sensible.
 */
export function ChipSensible({ registro }: { registro: RegistroAuditoria }) {
  if (!registro.sensible) return null;
  const base =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap';
  if (registro.revision) {
    return (
      <span
        className={cn(base, 'bg-estado-confirmado-fondo text-estado-confirmado-texto')}
        title={`Revisado por ${registro.revision.usuario.email} el ${formatearFechaHora(registro.revision.fecha)}`}
      >
        <Check className="size-3" /> Revisado
      </span>
    );
  }
  return (
    <span className={cn(base, 'bg-dorado/20 text-dorado-texto')}>
      <ShieldAlert className="size-3" />
      {registro.requiereRevision ? 'Sensible' : 'Sensible · gerencia'}
    </span>
  );
}

/** Los campos que cambiaron, cada uno con el antes tachado y el después destacado. */
export function ListaDeCambios({ registro }: { registro: RegistroAuditoria }) {
  return (
    <ul className="divide-y divide-border">
      {registro.campos.map((campo) => {
        const antes = registro.valorAnterior?.[campo];
        return (
          <li key={campo} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
            <p className="text-xs font-semibold">{nombreDeCampo(campo)}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {registro.tipo === 'alta' ? (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  vacío
                </span>
              ) : (
                <span className="rounded-md bg-estado-expirado-fondo px-2 py-0.5 text-estado-expirado-texto line-through">
                  {formatearValor(campo, antes)}
                </span>
              )}
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              <span className="rounded-md bg-estado-confirmado-fondo px-2 py-0.5 font-medium text-estado-confirmado-texto">
                {formatearValor(campo, registro.valorNuevo?.[campo])}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * «Revisado» para un cambio sensible que espera la revisión del GG. Solo lo ve el GG; desaparece
 * cuando el cambio ya está revisado o cuando no la necesita (lo hizo la gerencia o el Sistema).
 */
export function BotonRevisado({
  registro,
  texto = 'Revisado',
  className,
}: {
  registro: RegistroAuditoria;
  texto?: string;
  className?: string;
}) {
  const esGerente = useEsGerente();
  const marcar = useMarcarRevisado();
  if (!esGerente || !registro.requiereRevision || registro.revision) return null;
  return (
    <span className={cn('inline-flex flex-col items-end gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        disabled={marcar.isPending}
        onClick={() => marcar.mutate(registro.id)}
      >
        <Check /> {marcar.isPending ? 'Marcando…' : texto}
      </Button>
      {marcar.isError && (
        <span className="text-xs text-destructive">
          {marcar.error instanceof ErrorApiCliente
            ? marcar.error.message
            : 'No se pudo marcar como revisado.'}
        </span>
      )}
    </span>
  );
}
