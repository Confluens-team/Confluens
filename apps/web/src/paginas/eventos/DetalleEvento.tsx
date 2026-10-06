import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgendarEvento, useCancelarEvento, useEvento } from '@/hooks/use-eventos';
import { ErrorApiCliente } from '@/lib/api';

const PORCENTAJE_SENA = 0.2; // RN-01: 20% del total. Cálculo puro de frontend, sin soporte de backend.

const formateadorFecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const formateadorMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

interface DetalleEventoProps {
  eventoId: number;
}

// Vista central de HU-15: agendar el evento (distribución, horario y modalidad) y cancelarlo
// (criterio 5 / RN-07). Agendar NO reserva: el evento sigue EnConsulta hasta que un pago cruce el
// 20% de la base de cobro (HU-13). No existe un catálogo de distribuciones navegable todavía
// (mismo gap que salones/servicios en TomarConsulta.tsx), así que distribucionId se carga por id
// numérico.
export function DetalleEvento({ eventoId }: DetalleEventoProps) {
  const { data: evento, isLoading, isError } = useEvento(eventoId);
  const agendarEvento = useAgendarEvento(eventoId);
  const cancelarEvento = useCancelarEvento(eventoId);

  const [distribucionId, setDistribucionId] = useState('');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [modalidadSalonRestaurante, setModalidadSalonRestaurante] = useState(false);

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Cargando…</p>;
  if (isError || !evento) {
    return <p className="p-6 text-sm text-destructive">No se pudo cargar el evento.</p>;
  }

  const presupuestoVigente =
    evento.presupuestos.find((p) => p.estado === 'Confirmado') ??
    evento.presupuestos.find((p) => p.estado === 'Estimado') ??
    evento.presupuestos[0];
  const total = presupuestoVigente ? Number(presupuestoVigente.total) : 0;
  const montoSena = total * PORCENTAJE_SENA;

  const capacidadExcedida =
    agendarEvento.isError &&
    agendarEvento.error instanceof ErrorApiCliente &&
    agendarEvento.error.code === 'BUSINESS_RULE_VIOLATION';

  function enviarAgenda(confirmarCapacidadExcedida: boolean) {
    agendarEvento.mutate({
      distribucionId: Number(distribucionId),
      inicio: new Date(inicio).toISOString(),
      fin: new Date(fin).toISOString(),
      modalidadSalonRestaurante,
      confirmarCapacidadExcedida,
    });
  }

  function manejarEnvioAgenda(eventoFormulario: React.FormEvent) {
    eventoFormulario.preventDefault();
    enviarAgenda(false);
  }

  function manejarCancelacion() {
    if (!window.confirm('¿Cancelar este evento? Esta acción no se puede deshacer.')) return;
    cancelarEvento.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Evento #{evento.id}</h1>
        <p className="text-sm text-muted-foreground">
          Estado: <span className="font-medium">{evento.estado}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente y salón</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Cliente: </span>
            {evento.cliente.nombre} · {evento.cliente.telefono} · {evento.cliente.correo}
          </p>
          <p>
            <span className="text-muted-foreground">Salón: </span>
            {evento.salon.nombre} · {evento.cantidadPersonas} personas
          </p>
          {evento.solicitud && (
            <p className="text-muted-foreground">
              Consulta original enviada el{' '}
              {formateadorFecha.format(new Date(evento.solicitud.creadoEn))}
            </p>
          )}
        </CardContent>
      </Card>

      {presupuestoVigente && (
        <Card>
          <CardHeader>
            <CardTitle>Presupuesto ({presupuestoVigente.estado})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {presupuestoVigente.lineas.map((linea) => (
                <li key={linea.id} className="flex justify-between py-1.5">
                  <span>
                    {linea.descripcion} ×{linea.cantidad}
                  </span>
                  <span>{formateadorMoneda.format(Number(linea.subtotal))}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between font-medium">
              <span>Total (sin IVA)</span>
              <span>{formateadorMoneda.format(total)}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {evento.estado === 'EnConsulta' && (
        <Card>
          <CardHeader>
            <CardTitle>Agendar evento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={manejarEnvioAgenda} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="distribucionId">Distribución (id)</Label>
                  <Input
                    id="distribucionId"
                    type="number"
                    min={1}
                    value={distribucionId}
                    onChange={(e) => setDistribucionId(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2 pb-1.5">
                  <input
                    id="modalidadSalonRestaurante"
                    type="checkbox"
                    checked={modalidadSalonRestaurante}
                    onChange={(e) => setModalidadSalonRestaurante(e.target.checked)}
                  />
                  <Label htmlFor="modalidadSalonRestaurante">Modalidad salón-restaurante</Label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inicio">Inicio</Label>
                  <Input
                    id="inicio"
                    type="datetime-local"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fin">Fin</Label>
                  <Input
                    id="fin"
                    type="datetime-local"
                    value={fin}
                    onChange={(e) => setFin(e.target.value)}
                  />
                </div>
              </div>

              {agendarEvento.isError && (
                <p className="text-sm text-destructive">
                  {agendarEvento.error instanceof ErrorApiCliente
                    ? agendarEvento.error.message
                    : 'No se pudo agendar el evento.'}
                </p>
              )}

              {capacidadExcedida ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={agendarEvento.isPending}
                  onClick={() => enviarAgenda(true)}
                >
                  Confirmar igual
                </Button>
              ) : (
                <Button type="submit" disabled={agendarEvento.isPending} className="w-full">
                  {agendarEvento.isPending ? 'Agendando…' : 'Agendar evento'}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {evento.estado === 'Reservado' && (
        <Card>
          <CardHeader>
            <CardTitle>Seña</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Monto de la seña (20%): </span>
              {formateadorMoneda.format(montoSena)}
            </p>
            {evento.senaVenceEn && (
              <p>
                <span className="text-muted-foreground">Vence: </span>
                {formateadorFecha.format(new Date(evento.senaVenceEn))}
              </p>
            )}
            {evento.senaRegistradaEn && (
              <p className="text-muted-foreground">
                Seña registrada el {formateadorFecha.format(new Date(evento.senaRegistradaEn))}
              </p>
            )}

            {cancelarEvento.isError && (
              <p className="text-sm text-destructive">
                {cancelarEvento.error instanceof ErrorApiCliente
                  ? cancelarEvento.error.message
                  : 'No se pudo cancelar el evento.'}
              </p>
            )}
            <Button
              variant="destructive"
              disabled={cancelarEvento.isPending}
              onClick={manejarCancelacion}
            >
              Cancelar evento
            </Button>
          </CardContent>
        </Card>
      )}

      {(evento.estado === 'Cancelado' || evento.estado === 'Cobrado') && (
        <p className="text-sm text-muted-foreground">
          Este evento está {evento.estado === 'Cancelado' ? 'cancelado' : 'cobrado'}, no admite más
          acciones.
        </p>
      )}
    </div>
  );
}
