import type { ConsultaDetallada } from '@confluens/shared';
import { FileDown } from 'lucide-react';

import { BotonWhatsApp } from '@/components/BotonWhatsApp';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useSeguimientoConsulta } from '@/hooks/use-presupuestos';
import { ErrorApiCliente } from '@/lib/api';
import { mensajeWhatsApp } from '@/lib/whatsapp';

// Registro del seguimiento de una consulta con el cliente. Se puede tildar y destildar en cualquier
// estado: es el registro del Responsable de Eventos, no cambia la consulta.

const fechaYHora = (fecha: string) =>
  new Date(fecha).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

function CheckSeguimiento({
  id,
  etiqueta,
  marcadoEn,
  onCambio,
  deshabilitado,
}: {
  id: string;
  etiqueta: string;
  marcadoEn: string | null;
  onCambio: (marcado: boolean) => void;
  deshabilitado: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={marcadoEn !== null}
        disabled={deshabilitado}
        onCheckedChange={(marcado) => onCambio(marcado === true)}
      />
      <Label htmlFor={id}>{etiqueta}</Label>
      {marcadoEn && (
        <span className="text-xs text-muted-foreground">el {fechaYHora(marcadoEn)}</span>
      )}
    </div>
  );
}

function ErrorDeSeguimiento({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="text-sm text-destructive">
      {error instanceof ErrorApiCliente ? error.message : 'No se pudo guardar el seguimiento.'}
    </p>
  );
}

// Los dos pasos del seguimiento en el bloque del cliente, cada botón con su check:
// - WhatsApp y «Aviso al cliente»: tocar el botón lo tilda solo (la consulta deja de listarse como
//   «Nuevo»).
// - «Descargar PDF» y «Presupuesto enviado»: el presupuesto completo para mandárselo de manera
//   formal; guardar el PDF lo tilda solo. Una consulta social sin armar todavía no tiene
//   presupuesto (ADR 0008).
// Los dos checks también se tildan y destildan a mano.
export function SeguimientoConsulta({
  consulta,
  onDescargar,
}: {
  consulta: ConsultaDetallada;
  onDescargar: () => void;
}) {
  const seguimiento = useSeguimientoConsulta(consulta.id);
  const sinArmar = consulta.venceEn === null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <BotonWhatsApp
          telefono={consulta.cliente.telefono}
          mensaje={mensajeWhatsApp(consulta.cliente.nombre, consulta.evento.estado)}
          onClick={() => {
            if (!consulta.avisoRecepcionEn) seguimiento.mutate({ avisoRecepcion: true });
          }}
        />
        <CheckSeguimiento
          id="seguimiento-aviso"
          etiqueta="Aviso al cliente"
          marcadoEn={consulta.avisoRecepcionEn}
          deshabilitado={seguimiento.isPending}
          onCambio={(marcado) => seguimiento.mutate({ avisoRecepcion: marcado })}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={sinArmar}
          title={
            sinArmar
              ? 'Armá y guardá el presupuesto para poder descargarlo'
              : 'El PDF sale con lo último guardado de la consulta'
          }
          onClick={onDescargar}
        >
          <FileDown /> Descargar PDF
        </Button>
        <CheckSeguimiento
          id="seguimiento-envio"
          etiqueta="Presupuesto enviado"
          marcadoEn={consulta.envioFormalEn}
          deshabilitado={seguimiento.isPending}
          onCambio={(marcado) => seguimiento.mutate({ envioFormal: marcado })}
        />
      </div>
      <ErrorDeSeguimiento error={seguimiento.error} />
    </div>
  );
}
