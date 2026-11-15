import { CalendarDays } from 'lucide-react';
import { useState } from 'react';

import { Calendario } from '@/components/SelectorFechaHora';
import {
  type CambioDeFranja,
  extenderFranja,
  limitesParaExtender,
  quitarExtremo,
  textoDeDias,
} from '@/lib/rango-de-fechas';

const mesDe = (dia: string) => {
  const [anio = 1970, mes = 1] = dia.split('-').map(Number);
  return new Date(anio, mes - 1, 1);
};

/**
 * El calendario del evento, arriba del presupuesto (HU-50): muestra los días elegidos y deja sumar
 * más. Los días tienen que ser seguidos (ADR 0014), así que tocar un día antes del primero o después
 * del último estira la franja hasta él, con los del medio. Tocar un día del evento abre su tarjeta.
 * Solo se pueden sacar el primero o el último, con los botones de abajo.
 */
export function CalendarioDelEvento({
  inicio,
  fin,
  diaMinimo,
  diasCompletos,
  onCambiarFranja,
  onAbrirDia,
}: {
  inicio: string;
  fin: string;
  diaMinimo: string;
  // Las fechas que ya tienen todo cargado: se marcan con un punto debajo del número.
  diasCompletos: string[];
  onCambiarFranja: (cambio: CambioDeFranja) => void;
  onAbrirDia: (fecha: string) => void;
}) {
  const [mesVisible, setMesVisible] = useState(() => mesDe(inicio));
  const [diaBajoMouse, setDiaBajoMouse] = useState<string | null>(null);
  const limites = limitesParaExtender(inicio, fin, diaMinimo);
  const extension = diaBajoMouse ? extenderFranja(inicio, fin, diaBajoMouse) : null;
  const variosDias = fin !== inicio;

  function tocar(dia: string) {
    const cambio = extenderFranja(inicio, fin, dia);
    if (cambio) {
      onCambiarFranja(cambio);
      setDiaBajoMouse(null);
      return;
    }
    if (dia >= inicio && dia <= fin) onAbrirDia(dia);
  }

  function sacar(dia: string) {
    const cambio = quitarExtremo(inicio, fin, dia);
    if (cambio) onCambiarFranja(cambio);
  }

  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-bordo uppercase">
          <CalendarDays className="size-4 text-dorado" /> Tus días
        </p>
        <span className="text-xs text-muted-foreground">{textoDeDias(inicio, fin)}</span>
      </div>
      <Calendario
        className="w-full"
        dia={inicio}
        rango={{ inicio, fin }}
        onElegir={tocar}
        mesVisible={mesVisible}
        onCambiarMes={setMesVisible}
        diaMinimo={limites.desde}
        diaMaximo={limites.hasta}
        previsualizacion={extension ? { inicio: extension.inicio, fin: extension.fin } : null}
        onPasarPor={setDiaBajoMouse}
        diasMarcados={diasCompletos}
      />
      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {extension
          ? `Con este día, tu evento dura ${textoDeDias(extension.inicio, extension.fin)}. Los días nuevos entran vacíos.`
          : 'Tocá un día antes o después para sumarlo. Tocá un día del evento para cargarlo.'}
      </p>
      {variosDias && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-dashed border-border pt-3 text-xs">
          <button
            type="button"
            onClick={() => sacar(inicio)}
            className="text-muted-foreground underline-offset-2 hover:text-bordo hover:underline"
          >
            Sacar el primer día
          </button>
          <button
            type="button"
            onClick={() => sacar(fin)}
            className="text-muted-foreground underline-offset-2 hover:text-bordo hover:underline"
          >
            Sacar el último día
          </button>
        </div>
      )}
    </div>
  );
}
