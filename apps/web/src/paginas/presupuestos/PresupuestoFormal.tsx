import type { ConsultaDetallada } from '@confluens/shared';
import { ArrowLeft, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSeguimientoConsulta } from '@/hooks/use-presupuestos';
import { nombreCompleto } from '@/lib/formato';
import { CondicionesContratacion } from './CondicionesContratacion';
import { DocumentoPresupuesto } from './DocumentoPresupuesto';
import { HojaImagen } from './HojaA4';
import { horarioSalon } from './horario-salon';

// Al imprimir, las hojas de imagen y las de condiciones van a sangre (sin margen); el detalle lleva
// margen porque puede ocupar más de una hoja. Las reglas viven solo mientras esta vista está abierta,
// así no cambian la impresión de la comanda ni la del presupuesto del cliente.
const ESTILOS_DE_IMPRESION = `
@page { size: A4; margin: 0; }
@page detalle { margin: 14mm 12mm; }
`;

// El presupuesto completo de una consulta con el formato del PDF que Fran les manda hoy a los
// clientes: portada, el detalle (si no entra en una hoja sigue en la siguiente), formatos de
// armado, condiciones de contratación y cierre. Se imprime con el diálogo del navegador, como la
// comanda (ComandaEvento.tsx): sin dependencias nuevas y permite guardar como PDF. Guardarlo tilda
// «Presupuesto enviado» si no lo estaba.
export function PresupuestoFormal({
  consulta,
  onVolver,
}: {
  consulta: ConsultaDetallada;
  onVolver: () => void;
}) {
  const seguimiento = useSeguimientoConsulta(consulta.id);
  const cliente = nombreCompleto(consulta.cliente);
  const lineaSalon = consulta.lineas.find(({ tipo }) => tipo === 'salon');

  function guardarPdf() {
    if (!consulta.envioFormalEn) seguimiento.mutate({ envioFormal: true });
    // El título de la página es el nombre que el navegador le propone al PDF.
    const titulo = document.title;
    document.title = `Presupuesto ${String(consulta.id).padStart(6, '0')} - ${cliente}`;
    window.addEventListener('afterprint', () => (document.title = titulo), { once: true });
    window.print();
  }

  return (
    <div className="space-y-4">
      <style>{ESTILOS_DE_IMPRESION}</style>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button type="button" variant="ghost" size="sm" onClick={onVolver}>
          <ArrowLeft /> Volver a la consulta {consulta.id}
        </Button>
        <Button type="button" size="sm" onClick={guardarPdf}>
          <Printer /> Guardar como PDF
        </Button>
      </div>

      <div className="space-y-6 [print-color-adjust:exact] print:space-y-0">
        <HojaImagen src="/presupuesto-formal/portada.jpg" alt="Portada de Los Abuelos" />

        {/* Al imprimir llena la hoja con el color del documento: 297 mm menos los márgenes. */}
        <div className="mx-auto max-w-[210mm] [page:detalle] print:min-h-[269mm] print:max-w-none print:break-after-page print:bg-papel">
          <DocumentoPresupuesto
            id={consulta.id}
            estado={consulta.estado}
            emision={new Date(consulta.fechaEmision)}
            // Solo se llega acá con el presupuesto armado: el botón está deshabilitado sin él.
            vence={new Date(consulta.venceEn ?? consulta.fechaEmision)}
            cliente={{
              nombre: cliente,
              correo: consulta.cliente.correo,
              telefono: consulta.cliente.telefono,
            }}
            fechaEvento={consulta.evento.fecha}
            cantidadPersonas={consulta.evento.cantidadPersonas}
            salones={consulta.salones}
            tipoJornada={consulta.tipoJornada}
            lineas={consulta.lineas}
            total={consulta.total}
            salon={lineaSalon && { idLinea: lineaSalon.id, horario: horarioSalon(consulta.evento) }}
            sinCondiciones
          />
        </div>

        <HojaImagen
          src="/presupuesto-formal/formatos.jpg"
          alt="Formatos de armado de los salones"
        />
        <CondicionesContratacion />
        <HojaImagen src="/presupuesto-formal/cierre.jpg" alt="Saludo final y logo del hotel" />
      </div>
    </div>
  );
}
