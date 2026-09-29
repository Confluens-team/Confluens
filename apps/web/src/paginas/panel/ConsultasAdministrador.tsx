import type { Solicitud } from '@confluens/shared';
import { ArrowLeft, PenLine } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DetalleEvento } from '@/paginas/eventos/DetalleEvento';
import { TomarConsulta } from '@/paginas/eventos/TomarConsulta';
import { ListadoSolicitudes } from '@/paginas/solicitudes/ListadoSolicitudes';

type Vista =
  | { tipo: 'solicitudes' }
  | { tipo: 'tomar'; solicitud?: Solicitud }
  | { tipo: 'evento'; eventoId: number };

// Pestaña Consultas del administrador: el mismo circuito que usa el Responsable de Eventos, con las
// pantallas que ya existen. Solicitudes recibidas → tomar la consulta (genera cliente, evento
// EnConsulta y presupuesto, HU-05) → detalle del evento para reservar, registrar la seña o
// cancelar (HU-06). También se puede cargar una consulta a mano. El listado de presupuestos y
// eventos en consulta es HU-10 (Sprint 2) y lo desarrolla otro integrante: no va acá todavía.
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
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setVista({ tipo: 'tomar' })}>
          <PenLine /> Cargar una consulta a mano
        </Button>
      </div>
      <div className="rounded-xl bg-card ring-1 ring-border">
        <ListadoSolicitudes onTomar={(solicitud) => setVista({ tipo: 'tomar', solicitud })} />
      </div>
    </div>
  );
}
