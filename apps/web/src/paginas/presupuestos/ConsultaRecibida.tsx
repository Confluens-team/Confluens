import { etiquetaTipoEvento } from '@confluens/shared';
import { CheckCircle2, Home, RotateCcw } from 'lucide-react';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { fechaLocal, formatearFecha } from '@/lib/formato';
import type { ConsultaSocialEnviada } from './CotizarEvento';

// Confirmación de la consulta de un evento social (ADR 0008). No hay presupuesto que mostrar: lo
// arma el Responsable de Eventos con el cliente.
export function ConsultaRecibida({
  resultado,
  onOtra,
  onInicio,
}: {
  resultado: ConsultaSocialEnviada;
  onOtra: () => void;
  onInicio: () => void;
}) {
  const { consulta, cliente } = resultado;
  const filas = [
    ['Evento', etiquetaTipoEvento({ tipo: 'Social', ...consulta })],
    ['Fecha', formatearFecha(fechaLocal(consulta.fecha), true)],
    ['Invitados', `${consulta.cantidadPersonas} personas`],
    ['Duración', consulta.tipoJornada === 'completa' ? 'Jornada completa' : 'Media jornada'],
    [
      'Inicio estimado',
      consulta.horaInicioEstimada ? `${consulta.horaInicioEstimada} h` : 'A definir',
    ],
  ];

  return (
    <main className="fondo-papel min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <article className="relative rounded-sm bg-papel p-8 text-center shadow-xl ring-1 ring-border sm:p-12">
          <div
            className="pointer-events-none absolute inset-3 rounded-sm border border-dorado/40"
            aria-hidden
          />
          <div className="relative">
            <div className="flex justify-center">
              <Logo />
            </div>
            <CheckCircle2 className="mx-auto mt-8 size-12 text-emerald-700" />
            <h1 className="mt-4 font-serif text-3xl font-semibold text-bordo">
              Recibimos tu consulta
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Cada evento social es único. Un responsable de eventos se va a comunicar con vos al{' '}
              <span className="font-medium text-foreground">{cliente.telefono}</span> para elegir
              juntos el salón, la gastronomía y armar tu presupuesto.
            </p>

            <dl className="mx-auto mt-8 max-w-sm space-y-3 border-t border-dorado/40 pt-6 text-left text-sm">
              {filas.map(([etiqueta, valor]) => (
                <div key={etiqueta} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{etiqueta}</dt>
                  <dd className="text-right font-medium first-letter:uppercase">{valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        </article>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-11" onClick={onInicio}>
            <Home /> Volver al sitio
          </Button>
          <Button size="lg" variant="outline" className="h-11" onClick={onOtra}>
            <RotateCcw /> Hacer otra consulta
          </Button>
        </div>
      </div>
    </main>
  );
}
