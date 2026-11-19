import { DIAS_VIGENCIA_PRESUPUESTO, type LineaPresupuesto } from '@confluens/shared';
import { CheckCircle2, Home, Printer, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PresupuestoGenerado } from './CotizarEvento';
import { agruparPorDia } from '@/lib/dias-del-evento';
import { DocumentoPresupuesto, type DiaDelDocumento } from './DocumentoPresupuesto';
import { nombrePdfPresupuesto } from './nombre-pdf';

// Presupuesto Estimado recién generado, presentado como el documento que hoy el cliente recibe en
// PDF por WhatsApp. "Imprimir" usa el diálogo del navegador, que permite guardarlo como PDF.
export function PresupuestoEstimado({
  resultado,
  onOtro,
  onInicio,
}: {
  resultado: PresupuestoGenerado;
  onOtro: () => void;
  onInicio: () => void;
}) {
  const { presupuesto, salones, tipoJornada, cliente } = resultado;
  // HU-50: las líneas llegan con el día al que pertenecen. Los días se reparten en el orden en que
  // aparecen, que es el de la franja, y cada uno toma lo que se cotizó en su lugar.
  const dias: DiaDelDocumento[] | undefined = resultado.dias?.map((dia, i) => ({
    ...dia,
    lineas:
      agruparPorDia(presupuesto.lineas as (LineaPresupuesto & { diaId?: number })[])[i]?.lineas ??
      [],
  }));
  const emision = new Date(presupuesto.fechaEmision);
  const vence = new Date(emision);
  vence.setDate(vence.getDate() + DIAS_VIGENCIA_PRESUPUESTO);

  // El título de la página es el nombre que el navegador le propone al PDF, igual que en el
  // presupuesto formal: presupuesto-AAAA-MM-DD-apellido (reunión con el cliente, 05/11/2026).
  function imprimir() {
    const titulo = document.title;
    document.title = nombrePdfPresupuesto(presupuesto.evento.fecha.slice(0, 10), cliente);
    window.addEventListener('afterprint', () => (document.title = titulo), { once: true });
    window.print();
  }

  return (
    <main className="fondo-papel min-h-screen px-4 py-10 sm:px-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50 px-5 py-4 text-emerald-900 ring-1 ring-emerald-200 print:hidden">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">¡Listo! Generamos tu presupuesto estimado.</p>
            <p>
              Un responsable de eventos va a revisar la disponibilidad del salón y se va a comunicar
              con vos al {cliente.telefono}.
            </p>
          </div>
        </div>

        <DocumentoPresupuesto
          id={presupuesto.id}
          estado={presupuesto.estado}
          emision={emision}
          vence={vence}
          cliente={cliente}
          fechaEvento={presupuesto.evento.fecha}
          cantidadPersonas={presupuesto.evento.cantidadPersonas}
          salones={salones}
          tipoJornada={tipoJornada}
          lineas={presupuesto.lineas}
          dias={dias}
          total={presupuesto.total}
        />

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row print:hidden">
          <Button size="lg" className="h-11" onClick={imprimir}>
            <Printer /> Imprimir o guardar PDF
          </Button>
          <Button size="lg" variant="outline" className="h-11" onClick={onOtro}>
            <RotateCcw /> Armar otro presupuesto
          </Button>
          <Button size="lg" variant="ghost" className="h-11" onClick={onInicio}>
            <Home /> Volver al sitio
          </Button>
        </div>
      </div>
    </main>
  );
}
