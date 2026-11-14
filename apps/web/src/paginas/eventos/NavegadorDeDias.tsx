import type { EventoDetallado } from '@confluens/shared';
import { ChevronLeft, ChevronRight, Clock, MapPin, Sun, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { fechaLocal, formatearFecha } from '@/lib/formato';
import { cn } from '@/lib/utils';

const formateadorHora = new Intl.DateTimeFormat('es-AR', { timeStyle: 'short', hourCycle: 'h23' });

// Un dato del día como una pastilla con su ícono: se lee de un vistazo y no se pierde en una línea.
function Dato({
  icono,
  children,
  aviso = false,
}: {
  icono: ReactNode;
  children: ReactNode;
  aviso?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-foreground ring-1',
        aviso
          ? 'bg-amber-50 ring-amber-200 [&_svg]:text-amber-700'
          : 'bg-secondary/70 ring-dorado/30 [&_svg]:text-bordo',
      )}
    >
      <span className="[&_svg]:size-3.5" aria-hidden>
        {icono}
      </span>
      {children}
    </span>
  );
}

/**
 * HU-50: el selector del día de un evento de varios días. Es la primera sección del bloque que
 * comparte con lo que cambia con el día (las observaciones y el presupuesto, ver DetalleEvento): una
 * flecha de cada lado, como el calendario de la agenda, «Día 3 de 10» de un lado y la fecha del otro,
 * y debajo lo de ese día en pastillas (salones con su armado, personas, jornada y horario). Con diez
 * días o más una lista única se vuelve un scroll largo y se pierde de qué día es cada cosa.
 */
export function NavegadorDeDias({
  dias,
  indice,
  onCambiar,
}: {
  dias: EventoDetallado['dias'];
  indice: number;
  onCambiar: (indice: number) => void;
}) {
  const dia = dias[indice]!;
  const tieneHorario = !!dia.inicio && !!dia.fin;

  return (
    <CardContent className="space-y-3">
      <div className="flex items-center gap-3">
        <div role="group" aria-label="Cambiar de día" className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Día anterior"
            disabled={indice === 0}
            onClick={() => onCambiar(indice - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Día siguiente"
            disabled={indice === dias.length - 1}
            onClick={() => onCambiar(indice + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        {/* El número del día a un lado y la fecha al otro: se leen por separado. */}
        <p className="font-medium whitespace-nowrap">
          Día {indice + 1} de {dias.length}
        </p>
        <p className="ml-auto text-right text-sm font-medium text-bordo">
          <span className="first-letter:uppercase">
            {formatearFecha(fechaLocal(dia.fecha), true)}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {dia.salones.length > 0 ? (
          dia.salones.map((salon) => (
            <Dato key={salon.id} icono={<MapPin />}>
              {salon.nombre}
              {salon.distribucion && (
                <span className="text-muted-foreground"> · {salon.distribucion.nombre}</span>
              )}
            </Dato>
          ))
        ) : (
          <Dato icono={<MapPin />} aviso>
            Salón a definir
          </Dato>
        )}
        <Dato icono={<Users />}>{dia.cantidadPersonas} personas</Dato>
        {dia.tipoJornada && (
          <Dato icono={<Sun />}>
            {dia.tipoJornada === 'completa' ? 'Jornada completa' : 'Media jornada'}
          </Dato>
        )}
        <Dato icono={<Clock />} aviso={!tieneHorario}>
          {tieneHorario
            ? `${formateadorHora.format(new Date(dia.inicio!))} a ${formateadorHora.format(new Date(dia.fin!))}`
            : 'Sin horario'}
        </Dato>
      </div>
    </CardContent>
  );
}
