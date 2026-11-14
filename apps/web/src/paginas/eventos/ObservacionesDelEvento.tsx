import type { EventoDetallado } from '@confluens/shared';
import { Save } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useGuardarObservaciones } from '@/hooks/use-eventos';
import { ErrorApiCliente } from '@/lib/api';

// Observaciones de un día del evento: pedidos del cliente, acuerdos, avisos al equipo. Cada día tiene
// las suyas (HU-50). Son internas del personal, no salen en el presupuesto ni en la comanda. El
// borrador vive acá mientras se escribe y se manda con «Guardar»: guardar en cada tecla pegaría a la
// API en cada letra. El que la usa le pone `key` con el id del día, así cada día arranca con su texto.
export function ObservacionesDelEvento({
  evento,
  dia,
  integrada = false,
}: {
  evento: EventoDetallado;
  dia: EventoDetallado['dias'][number];
  // En un evento de varios días va dentro del bloque del día, sin tarjeta propia.
  integrada?: boolean;
}) {
  const guardadas = dia.observaciones ?? '';
  const [texto, setTexto] = useState(guardadas);
  const guardar = useGuardarObservaciones(evento.id);
  const sinGuardar = texto.trim() !== guardadas;
  const cancelado = evento.estado === 'Cancelado';

  // Un evento cancelado ya no admite cambios: se muestra lo que tenía anotado, y si no tenía nada
  // la tarjeta no aparece.
  if (cancelado && !guardadas) return null;

  const contenido = (
    <>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>
          <label htmlFor="evento-observaciones">Observaciones</label>
        </CardTitle>
        {!cancelado && (
          <div className="flex items-center gap-2">
            {guardar.isError && (
              <span role="alert" className="text-xs text-destructive">
                {guardar.error instanceof ErrorApiCliente
                  ? guardar.error.message
                  : 'No se pudieron guardar'}
              </span>
            )}
            {sinGuardar ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={guardar.isPending}
                onClick={() => guardar.mutate({ observaciones: texto.trim(), fecha: dia.fecha })}
              >
                <Save /> {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Guardadas</span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          id="evento-observaciones"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          readOnly={cancelado}
          maxLength={2000}
          placeholder="Pedidos del cliente, acuerdos, avisos para el equipo…"
          className="min-h-24 border-dashed"
        />
        <p className="text-xs text-muted-foreground">Solo lo ve el personal.</p>
      </CardContent>
    </>
  );
  return integrada ? contenido : <Card>{contenido}</Card>;
}
