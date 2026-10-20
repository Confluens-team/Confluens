import type { ConsultaDetallada } from '@confluens/shared';
import { ArrowLeft, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSeguimientoConsulta } from '@/hooks/use-presupuestos';
import { nombreCompleto } from '@/lib/formato';
import { DocumentoPresupuesto } from './DocumentoPresupuesto';

// El presupuesto completo de una consulta, con el mismo diseño que el que ve el cliente al cotizar,
// para que el Responsable de Eventos lo guarde en PDF y se lo mande de manera formal. Se imprime
// con el diálogo del navegador, como la comanda (ComandaEvento.tsx): sin dependencias nuevas y
// permite guardar como PDF. Guardarlo tilda «Presupuesto enviado» si no lo estaba.
export function PresupuestoFormal({
  consulta,
  onVolver,
}: {
  consulta: ConsultaDetallada;
  onVolver: () => void;
}) {
  const seguimiento = useSeguimientoConsulta(consulta.id);

  function guardarPdf() {
    if (!consulta.envioFormalEn) seguimiento.mutate({ envioFormal: true });
    window.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button type="button" variant="ghost" size="sm" onClick={onVolver}>
          <ArrowLeft /> Volver a la consulta {consulta.id}
        </Button>
        <Button type="button" size="sm" onClick={guardarPdf}>
          <Printer /> Guardar como PDF
        </Button>
      </div>
      <div className="mx-auto max-w-3xl">
        <DocumentoPresupuesto
          id={consulta.id}
          estado={consulta.estado}
          emision={new Date(consulta.fechaEmision)}
          // Solo se llega acá con el presupuesto armado: EnvioFormal deshabilita el botón sin él.
          vence={new Date(consulta.venceEn ?? consulta.fechaEmision)}
          cliente={{
            nombre: nombreCompleto(consulta.cliente),
            correo: consulta.cliente.correo,
            telefono: consulta.cliente.telefono,
          }}
          fechaEvento={consulta.evento.fecha}
          cantidadPersonas={consulta.evento.cantidadPersonas}
          salones={consulta.salones}
          tipoJornada={consulta.tipoJornada}
          lineas={consulta.lineas}
          total={consulta.total}
        />
      </div>
    </div>
  );
}
