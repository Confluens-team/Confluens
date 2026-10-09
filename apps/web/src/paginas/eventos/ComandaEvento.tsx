import type { ConsultaDetallada } from '@confluens/shared';
import { ArrowLeft, Printer } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useConsulta } from '@/hooks/use-presupuestos';
import { fechaLocal, formatearFecha, nombreCompleto } from '@/lib/formato';

// Comanda de cocina de un evento ya confirmado: la hoja que se imprime y se cuelga en la cocina.
// Lleva fecha, salón, horario, cantidad de personas y los servicios de gastronomía ordenados por
// la hora a la que se los espera. **Sin precios**: no es un documento comercial.
//
// Se imprime con el diálogo del navegador (window.print()), igual que el presupuesto del cliente
// en PresupuestoEstimado.tsx: sin dependencias nuevas y permite guardar como PDF. Todo lo que no
// va al papel lleva `print:hidden`.
//
// Qué entra y qué no: las líneas de servicio del catálogo que no son tercerizadas. Quedan afuera
// la línea del salón (su horario ya está en el encabezado) y los tercerizados, que son audiovisual
// y pantallas, no cocina. Los adicionales escritos a mano van aparte, al pie: pueden ser de cocina
// («torta de cumpleaños») o no («decoración»), y dejarlos afuera sería peor que mostrarlos.

const hora = (instante: string) =>
  new Date(instante).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

// Primero las que tienen hora, en orden; las que no, al final y en el orden en que se cargaron.
// Mezclarlas haría parecer que un servicio sin hora va a las 00:00.
function porHora(lineas: ConsultaDetallada['lineas']) {
  return [...lineas].sort((a, b) => {
    if (!a.horaEstimada && !b.horaEstimada) return 0;
    if (!a.horaEstimada) return 1;
    if (!b.horaEstimada) return -1;
    return a.horaEstimada.localeCompare(b.horaEstimada);
  });
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[0.6rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-xl font-semibold text-bordo print:text-black">{valor}</p>
    </div>
  );
}

function Hoja({ consulta }: { consulta: ConsultaDetallada }) {
  // Lo que se escribe acá se imprime, pero todavía no se guarda: al salir de la pantalla se
  // pierde. Guardarlo necesita una columna nueva en Evento y su migración (AGENTS.md §6).
  const [observaciones, setObservaciones] = useState('');
  const { evento } = consulta;
  const gastronomia = porHora(
    consulta.lineas.filter((l) => l.tipo === 'servicio' && !l.tercerizado),
  );
  const aMano = consulta.lineas.filter((l) => l.tipo === 'adicional');
  const horario =
    evento.inicio && evento.fin ? `${hora(evento.inicio)} a ${hora(evento.fin)}` : 'A confirmar';

  return (
    <article className="mx-auto max-w-3xl rounded-xl bg-card p-8 ring-1 ring-border print:max-w-none print:rounded-none print:p-0 print:ring-0">
      <header className="flex items-baseline justify-between gap-4 border-b-2 border-bordo pb-3 print:border-black">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-bordo print:text-black">
            Comanda de evento
          </h2>
          <p className="text-xs text-muted-foreground">Los Abuelos · Hotel Dr. César Carman</p>
        </div>
        <p className="font-serif text-lg tabular-nums">N° {String(consulta.id).padStart(6, '0')}</p>
      </header>

      <p className="mt-6 font-serif text-3xl font-semibold text-bordo uppercase print:text-black">
        {formatearFecha(fechaLocal(evento.fecha), true)}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-5 border-y border-border py-5 sm:grid-cols-4 print:border-black/30">
        <Dato rotulo="Salón" valor={consulta.salon?.nombre ?? 'A definir'} />
        <Dato rotulo="Armado" valor={evento.distribucion?.nombre ?? 'A definir'} />
        <Dato rotulo="Horario" valor={horario} />
        <Dato rotulo="Personas" valor={String(evento.cantidadPersonas)} />
      </div>

      <p className="mt-4 text-sm">
        <span className="text-muted-foreground">Cliente: </span>
        <span className="font-medium">{nombreCompleto(consulta.cliente)}</span>
      </p>

      <section className="mt-8 break-inside-avoid">
        <h3 className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Gastronomía
        </h3>
        {gastronomia.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Este evento no tiene servicios de gastronomía cargados.
          </p>
        ) : (
          <table className="mt-3 w-full text-left">
            <tbody>
              {gastronomia.map((linea) => (
                <tr key={linea.id} className="border-b border-border/70 print:border-black/20">
                  <td className="w-24 py-3 font-serif text-xl font-semibold tabular-nums">
                    {linea.horaEstimada ?? '—'}
                  </td>
                  <td className="py-3 text-lg">{linea.descripcion}</td>
                  <td className="w-20 py-3 text-right font-serif text-xl font-semibold tabular-nums">
                    {linea.cantidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {aMano.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <h3 className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Otros ítems cargados a mano
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {aMano.map((linea) => (
              <li
                key={linea.id}
                className="flex justify-between gap-4 border-b border-border/70 pb-1.5 print:border-black/20"
              >
                <span>
                  {linea.horaEstimada && (
                    <span className="mr-2 font-medium tabular-nums">{linea.horaEstimada}</span>
                  )}
                  {linea.descripcion}
                </span>
                <span className="tabular-nums">{linea.cantidad}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Estas hojas siempre terminan con algo anotado: menús especiales, alergias, a quién
          buscar. Se puede escribir acá antes de imprimir, o dejarlo vacío y anotar a mano sobre el
          papel. En el papel va el texto tipeado, no el campo: un textarea con alto fijo recortaría
          lo que no entra, y encima imprimiría el borde del control. */}
      <section className="mt-8 break-inside-avoid">
        <label
          htmlFor="comanda-observaciones"
          className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
        >
          Observaciones
        </label>
        <Textarea
          id="comanda-observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Menús especiales, alergias, contacto en el salón, lo que haga falta…"
          className="mt-2 min-h-28 border-dashed print:hidden"
        />
        <div className="mt-2 hidden min-h-28 rounded-md border border-dashed border-black/40 px-3 py-2 whitespace-pre-wrap print:block">
          {observaciones}
        </div>
      </section>
    </article>
  );
}

export function ComandaEvento({
  presupuestoId,
  onVolver,
}: {
  presupuestoId: number;
  onVolver: () => void;
}) {
  const consulta = useConsulta(presupuestoId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={onVolver}>
          <ArrowLeft /> Volver al evento
        </Button>
        {consulta.data && (
          <Button size="sm" onClick={() => window.print()}>
            <Printer /> Imprimir comanda
          </Button>
        )}
      </div>

      {consulta.isLoading && <p className="text-sm text-muted-foreground">Cargando la comanda…</p>}
      {consulta.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo cargar la comanda.
        </p>
      )}
      {consulta.data && consulta.data.estado !== 'Confirmado' && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 print:hidden">
          Este presupuesto está {consulta.data.estado}: la comanda es del evento ya confirmado, así
          que lo que ves acá todavía puede cambiar.
        </p>
      )}
      {consulta.data && <Hoja consulta={consulta.data} />}
    </div>
  );
}
