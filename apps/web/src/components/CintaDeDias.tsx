import { useEffect, useRef } from 'react';

import {
  diaDeSemanaCorto,
  esLunes,
  type EstadoDelDia,
  numeroDelDia,
  textoDelDia,
} from '@/lib/cinta-de-dias';
import { cn } from '@/lib/utils';

export interface DiaDeLaCinta {
  fecha: string;
  // Debajo del número: «Auditorio + Pucará · 300».
  resumen: string;
  estado: EstadoDelDia;
  // El texto del estado, si no es el de siempre (por ejemplo «Sin horario» en un evento).
  textoEstado?: string;
}

const ESTADOS: Record<
  EstadoDelDia,
  { texto: string; punto: string; color: string; borde: string }
> = {
  completo: {
    texto: 'Completo',
    punto: 'bg-estado-confirmado',
    color: 'text-estado-confirmado-texto',
    borde: 'border-border',
  },
  // Rojo (19/11/2026): el salmón de «Expirado» se confundía con los avisos que no son choques.
  conflicto: {
    texto: 'En conflicto',
    punto: 'bg-destructive',
    color: 'text-destructive',
    borde: 'border-destructive',
  },
  sinCargar: {
    texto: 'Sin cargar',
    punto: 'bg-estado-consulta',
    color: 'text-estado-consulta-texto',
    borde: 'border-dashed border-dorado/70',
  },
  pendiente: {
    texto: 'Incompleto',
    punto: 'bg-estado-consulta',
    color: 'text-estado-consulta-texto',
    borde: 'border-border',
  },
};

// Con más de una semana, la cinta marca dónde empieza cada una: con muchos días (hasta 32) los
// números solos no dicen en qué semana se está.
const DIAS_PARA_SEPARAR_SEMANAS = 8;

/**
 * HU-50: la cinta de días de un evento de varios días (docs/diseno/panel-evento-cinta-de-dias.md).
 * Una mini-tarjeta por día, en orden, con su estado: se ven todos de un vistazo y se edita uno por
 * vez. Con muchos días hace scroll horizontal y mantiene visible el elegido.
 */
export function CintaDeDias({
  dias,
  indice,
  onElegir,
}: {
  dias: DiaDeLaCinta[];
  indice: number;
  onElegir: (indice: number) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const primeraVez = useRef(true);
  useEffect(() => {
    // Al abrir no se mueve nada: solo cuando se elige otro día (también desde un aviso).
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    refs.current[indice]?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [indice]);

  const separarSemanas = dias.length >= DIAS_PARA_SEPARAR_SEMANAS;

  return (
    <div
      role="group"
      aria-label="Días del evento"
      className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pt-1 pb-2"
    >
      {dias.map((dia, i) => {
        const estado = ESTADOS[dia.estado];
        const elegido = i === indice;
        return (
          <div key={dia.fecha} className="flex shrink-0 gap-2.5">
            {separarSemanas && i > 0 && esLunes(dia.fecha) && (
              <span aria-hidden className="my-2 w-px shrink-0 bg-dorado/40" />
            )}
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              aria-pressed={elegido}
              title={`${textoDelDia(dia.fecha)} · Día ${i + 1} de ${dias.length}`}
              onClick={() => onElegir(i)}
              className={cn(
                'flex w-36 flex-col gap-1 rounded-xl bg-card text-left transition-colors hover:border-bordo/60',
                elegido
                  ? 'border-2 border-bordo bg-crema p-[11px]'
                  : cn('border p-3', estado.borde),
              )}
            >
              <span className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {diaDeSemanaCorto(dia.fecha)}
              </span>
              <span className="font-heading text-xl leading-none font-semibold text-bordo">
                {numeroDelDia(dia.fecha)}
              </span>
              <span
                className={cn(
                  'truncate text-xs',
                  dia.estado === 'sinCargar' && 'text-muted-foreground',
                )}
              >
                {dia.resumen}
              </span>
              <span className={cn('inline-flex items-center gap-1.5 text-xs', estado.color)}>
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', estado.punto)} />
                {dia.textoEstado ?? estado.texto}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
