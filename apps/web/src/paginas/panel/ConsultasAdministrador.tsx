import type { Solicitud } from '@confluens/shared';
import { ArrowLeft, ClipboardList, Inbox, PenLine } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Agenda } from '@/paginas/eventos/Agenda';
import { DetalleEvento } from '@/paginas/eventos/DetalleEvento';
import { TomarConsulta } from '@/paginas/eventos/TomarConsulta';
import { ListadoSolicitudes } from '@/paginas/solicitudes/ListadoSolicitudes';

type Vista =
  | { tipo: 'solicitudes' }
  | { tipo: 'en-consulta' }
  | { tipo: 'tomar'; solicitud?: Solicitud }
  | { tipo: 'evento'; eventoId: number };

// Pestaña Consultas del administrador: el mismo circuito que usa el Responsable de Eventos, con las
// pantallas que ya existen. Solicitudes recibidas → tomar la consulta (genera cliente, evento
// EnConsulta y presupuesto, HU-05) → detalle del evento para reservar, registrar la seña o
// cancelar (HU-06). También se puede cargar una consulta a mano o retomar un evento en consulta.
export function ConsultasAdministrador() {
  const [vista, setVista] = useState<Vista>({ tipo: 'solicitudes' });

  if (vista.tipo === 'tomar' || vista.tipo === 'evento') {
    return (
      <div className="rounded-xl bg-card ring-1 ring-border">
        <div className="mx-auto max-w-2xl px-6 pt-6">
          <Button variant="ghost" size="sm" onClick={() => setVista({ tipo: 'solicitudes' })}>
            <ArrowLeft /> Volver a las consultas
          </Button>
        </div>
        {vista.tipo === 'tomar' ? (
          <TomarConsulta
            solicitud={vista.solicitud}
            onCreado={(eventoId) => setVista({ tipo: 'evento', eventoId })}
          />
        ) : (
          <DetalleEvento eventoId={vista.eventoId} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {(
            [
              { valor: 'solicitudes', texto: 'Solicitudes recibidas', icono: Inbox },
              { valor: 'en-consulta', texto: 'Eventos en consulta', icono: ClipboardList },
            ] as const
          ).map(({ valor, texto, icono: Icono }) => (
            <button
              key={valor}
              type="button"
              onClick={() => setVista({ tipo: valor })}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                vista.tipo === valor ? 'bg-card shadow-sm' : 'text-muted-foreground',
              )}
            >
              <Icono className="size-4" /> {texto}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setVista({ tipo: 'tomar' })}>
          <PenLine /> Cargar una consulta a mano
        </Button>
      </div>

      {vista.tipo === 'solicitudes' ? (
        <div className="rounded-xl bg-card ring-1 ring-border">
          <ListadoSolicitudes onTomar={(solicitud) => setVista({ tipo: 'tomar', solicitud })} />
        </div>
      ) : (
        <Agenda enConsulta />
      )}
    </div>
  );
}
