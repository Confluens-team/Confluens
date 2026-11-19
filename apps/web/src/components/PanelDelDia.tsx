import { AlertTriangle } from 'lucide-react';

import { type AvisoDelDia, textoDelDia } from '@/lib/cinta-de-dias';
import { cn } from '@/lib/utils';

// Las piezas del panel del día elegido en la cinta (HU-50, docs/diseno/panel-evento-cinta-de-dias.md),
// compartidas por la consulta y el evento: el título del día, los datos clave en bloques y los avisos
// accionables de la columna derecha.

/** «Martes 8 de diciembre · Día 2 de 5», con las acciones del día a la derecha. */
export function EncabezadoDelDia({
  fecha,
  indice,
  total,
  children,
}: {
  fecha: string;
  indice: number;
  total: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-bordo">
        {textoDelDia(fecha)}
        {total > 1 && (
          <span className="font-normal text-muted-foreground">
            {' '}
            · Día {indice + 1} de {total}
          </span>
        )}
      </h3>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** Un dato clave del día en un bloque: horario, personas, salones. */
export function DatoDelDia({
  etiqueta,
  children,
  ayuda,
  className,
}: {
  etiqueta: React.ReactNode;
  children: React.ReactNode;
  // Debajo del valor, más chico: la jornada debajo del horario, por ejemplo.
  ayuda?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded-xl bg-crema p-3 ring-1 ring-border', className)}>
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="mt-1 font-semibold">{children}</div>
      {ayuda && <div className="mt-0.5 text-xs text-muted-foreground">{ayuda}</div>}
    </div>
  );
}

const TONOS: Record<AvisoDelDia['tono'], string> = {
  conflicto: 'bg-destructive/10 text-destructive ring-1 ring-destructive/30',
  sinCargar: 'bg-estado-consulta-fondo text-estado-consulta-texto',
  pendiente: 'bg-estado-consulta-fondo text-estado-consulta-texto',
};

/**
 * El choque del día que se está editando (19/11/2026), en rojo y dentro del día, arriba de sus
 * datos: en la columna derecha se perdía entre los avisos que no son choques.
 */
export function AvisoDeConflictoDelDia({ aviso }: { aviso: AvisoDelDia }) {
  return (
    <div
      role="alert"
      className="mt-4 flex gap-2.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive ring-1 ring-destructive/30"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <strong className="block">{aviso.titulo}</strong>
        <span>{aviso.texto}</span>
      </div>
    </div>
  );
}

/**
 * Los avisos accionables de los días, debajo de la cuenta: un conflicto (con qué evento y horario) o
 * un día sin cargar, cada uno con «Ver el día», que lo elige en la cinta.
 */
export function AvisosDeLosDias({
  avisos,
  onVerDia,
}: {
  avisos: AvisoDelDia[];
  onVerDia: (indice: number) => void;
}) {
  if (avisos.length === 0) return null;
  return (
    <ul aria-label="Avisos de los días" className="space-y-2.5">
      {avisos.map((aviso) => (
        <li key={aviso.clave} className={cn('rounded-lg p-3 text-sm', TONOS[aviso.tono])}>
          <strong className="block">{aviso.titulo}</strong>
          <span>{aviso.texto}</span>
          {aviso.indice !== undefined && (
            <button
              type="button"
              onClick={() => onVerDia(aviso.indice!)}
              className="mt-1.5 block font-semibold underline-offset-2 hover:underline"
            >
              Ver el día
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
