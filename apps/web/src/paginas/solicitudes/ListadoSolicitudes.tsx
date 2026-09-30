import type { Solicitud } from '@confluens/shared';

import { Button } from '@/components/ui/button';
import { useSalones } from '@/hooks/use-salones';
import { useSolicitudes } from '@/hooks/use-solicitudes';

// fechaDeseada es una fecha de calendario (YYYY-MM-DD) que new Date() toma como medianoche UTC:
// formateada en hora de Argentina se veía un día antes. Se formatea en UTC para mostrar el día real.
const formateadorFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' });

interface ListadoSolicitudesProps {
  onTomar: (solicitud: Solicitud) => void;
}

// Vista interna para el Responsable de Eventos (criterio 4 de HU-14): "ve la solicitud
// diferenciada visualmente de reservas y eventos". La diferenciación es la etiqueta "Solicitud" —
// el mismo lenguaje visual (badge) se reutiliza cuando aparezcan las otras dos listas. Desde
// HU-15, cada solicitud sin tomar (eventoId null) tiene un botón "Tomar consulta" que arranca
// TomarConsulta.tsx precargado con sus datos.
// Sin autenticación todavía: cuando se monte el middleware de HU-27, este endpoint pasa a
// requerir sesión de RE/GG (mismo comentario que en solicitudes.controlador.ts).
export function ListadoSolicitudes({ onTomar }: ListadoSolicitudesProps) {
  const { data: solicitudes, isLoading, isError } = useSolicitudes();
  // Para mostrar el nombre del salón que el cliente eligió en la landing (HU-07) en vez del id.
  // Se usa el listado interno (no el público) porque un salón despublicado sigue apareciendo en
  // solicitudes viejas y el RE tiene que poder leerlo igual.
  const { data: salones } = useSalones();

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Solicitudes recibidas</h1>
        <p className="text-sm text-muted-foreground">Vista interna del Responsable de Eventos.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && (
        <p className="text-sm text-destructive">No se pudieron cargar las solicitudes.</p>
      )}
      {solicitudes && solicitudes.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no llegó ninguna solicitud.</p>
      )}

      <ul className="divide-y rounded-lg border">
        {solicitudes?.map((solicitud) => (
          <li key={solicitud.id} className="flex items-center justify-between gap-4 p-3 text-sm">
            <div>
              <p className="font-medium">{solicitud.nombre}</p>
              <p className="text-muted-foreground">
                {solicitud.telefono} · {solicitud.correo} · {solicitud.cantidadPersonas} personas ·{' '}
                {formateadorFecha.format(new Date(solicitud.fechaDeseada))}
              </p>
              {solicitud.salonId !== null && (
                <p className="text-muted-foreground">
                  Salón de interés:{' '}
                  {salones?.find((salon) => salon.id === solicitud.salonId)?.nombre ??
                    `#${solicitud.salonId}`}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                Solicitud
              </span>
              {solicitud.eventoId === null && (
                <Button size="sm" onClick={() => onTomar(solicitud)}>
                  Tomar consulta
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
