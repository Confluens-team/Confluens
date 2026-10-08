import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Selector de día y hora uno al lado del otro: un calendario mensual y, a su derecha, la hora en
// formato de 12 horas con AM/PM (columnas de hora y minutos). Reemplaza al <input
// type="datetime-local">, que cada navegador dibuja distinto y separa el día de la hora.
//
// Trabaja con el mismo valor que ese input, "YYYY-MM-DDTHH:mm" en la hora local, para que quien lo
// usa lo convierta a ISO igual que antes. Sin dependencias nuevas: Popover de radix-ui (ya
// instalado) y la grilla del mes armada a mano.

const DIAS_SEMANA = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const HORAS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
// De a 5 minutos: un evento no arranca a las 21:07, y la columna queda corta.
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5);

const formateadorMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const formateadorDia = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

interface Borrador {
  dia: string; // YYYY-MM-DD, '' si todavía no se eligió
  hora12: number; // 1..12
  minuto: number;
  pm: boolean;
}

const dosDigitos = (n: number) => n.toString().padStart(2, '0');
// "YYYY-MM-DD" → Date a la medianoche local (new Date("YYYY-MM-DD") la tomaría en UTC).
function deDiaISO(dia: string): Date {
  const [a = 1970, m = 1, d = 1] = dia.split('-').map(Number);
  return new Date(a, m - 1, d);
}
const diaISO = (fecha: Date) =>
  `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;

function aBorrador(valor: string, diaSugerido: string, horaSugerida: string): Borrador {
  const [dia = diaSugerido, hora = horaSugerida] = valor ? valor.split('T') : [];
  const [h = 12, m = 0] = (hora || '12:00').split(':').map(Number);
  return { dia, hora12: h % 12 === 0 ? 12 : h % 12, minuto: m - (m % 5), pm: h >= 12 };
}

function aValor({ dia, hora12, minuto, pm }: Borrador): string {
  const h24 = (hora12 % 12) + (pm ? 12 : 0);
  return `${dia}T${dosDigitos(h24)}:${dosDigitos(minuto)}`;
}

function textoDelValor(valor: string): string {
  const { dia, hora12, minuto, pm } = aBorrador(valor, '', '');
  return `${formateadorDia.format(deDiaISO(dia))} · ${hora12}:${dosDigitos(minuto)} ${pm ? 'PM' : 'AM'}`;
}

// Las celdas del mes, de lunes a domingo; null en los huecos antes del día 1.
function celdasDelMes(anio: number, mes: number): (Date | null)[] {
  const primero = new Date(anio, mes, 1);
  const huecos = (primero.getDay() + 6) % 7; // getDay: 0 = domingo
  const dias = new Date(anio, mes + 1, 0).getDate();
  return [
    ...Array<null>(huecos).fill(null),
    ...Array.from({ length: dias }, (_, i) => new Date(anio, mes, i + 1)),
  ];
}

function ColumnaRueda({
  etiqueta,
  opciones,
  elegida,
  onElegir,
  formato,
}: {
  etiqueta: string;
  opciones: number[];
  elegida: number;
  onElegir: (valor: number) => void;
  formato: (valor: number) => string;
}) {
  const refColumna = useRef<HTMLDivElement>(null);
  const refElegida = useRef<HTMLButtonElement>(null);
  // Al abrir, la opción elegida queda centrada, como en una rueda. Se mueve solo la columna:
  // scrollIntoView también correría la página entera detrás del popover.
  useEffect(() => {
    const columna = refColumna.current;
    const elegida = refElegida.current;
    if (!columna || !elegida) return;
    columna.scrollTop = elegida.offsetTop - (columna.clientHeight - elegida.offsetHeight) / 2;
  }, []);

  return (
    <div
      ref={refColumna}
      role="listbox"
      aria-label={etiqueta}
      className="relative h-44 w-14 snap-y overflow-y-auto py-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {opciones.map((opcion) => (
        <button
          key={opcion}
          ref={opcion === elegida ? refElegida : undefined}
          type="button"
          role="option"
          aria-selected={opcion === elegida}
          onClick={() => onElegir(opcion)}
          className={cn(
            'block h-9 w-full snap-center rounded-md text-center text-base tabular-nums transition-colors',
            opcion === elegida
              ? 'bg-dorado/20 font-semibold text-bordo'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {formato(opcion)}
        </button>
      ))}
    </div>
  );
}

interface SelectorFechaHoraProps {
  id?: string;
  value: string;
  onChange: (valor: string) => void;
  // Día que viene marcado al abrir si todavía no hay valor (por ejemplo, la fecha del evento).
  diaSugerido?: string;
  // Hora que se propone si todavía no hay valor, "HH:mm".
  horaSugerida?: string;
  // No se pueden elegir días anteriores a este (YYYY-MM-DD).
  diaMinimo?: string;
  placeholder?: string;
}

export function SelectorFechaHora({
  id,
  value,
  onChange,
  diaSugerido = diaISO(new Date()),
  horaSugerida = '12:00',
  diaMinimo,
  placeholder = 'Elegir día y hora',
}: SelectorFechaHoraProps) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(() => aBorrador(value, '', horaSugerida));
  const [mesVisible, setMesVisible] = useState(() => new Date());

  function abrir(estado: boolean) {
    if (estado) {
      const inicial = aBorrador(value, diaSugerido, horaSugerida);
      setBorrador(inicial);
      const dia = deDiaISO(inicial.dia || diaSugerido);
      setMesVisible(new Date(dia.getFullYear(), dia.getMonth(), 1));
    }
    setAbierto(estado);
  }

  function aceptar() {
    if (!borrador.dia) return;
    onChange(aValor(borrador));
    setAbierto(false);
  }

  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  const hoy = diaISO(new Date());

  return (
    <Popover.Root open={abierto} onOpenChange={abrir}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value ? textoDelValor(value) : placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 rounded-xl bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-border"
        >
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Día */}
            <div className="w-64">
              <div className="mb-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Mes anterior"
                  onClick={() => setMesVisible(new Date(anio, mes - 1, 1))}
                >
                  <ChevronLeft />
                </Button>
                <span className="text-sm font-medium capitalize">
                  {formateadorMes.format(mesVisible)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Mes siguiente"
                  onClick={() => setMesVisible(new Date(anio, mes + 1, 1))}
                >
                  <ChevronRight />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                {DIAS_SEMANA.map((dia) => (
                  <span key={dia} className="py-1 text-muted-foreground">
                    {dia}
                  </span>
                ))}
                {celdasDelMes(anio, mes).map((fecha, i) => {
                  if (!fecha) return <span key={`hueco-${i}`} />;
                  const iso = diaISO(fecha);
                  const elegido = iso === borrador.dia;
                  const deshabilitado = diaMinimo !== undefined && iso < diaMinimo;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={deshabilitado}
                      aria-pressed={elegido}
                      aria-label={formateadorDia.format(fecha)}
                      onClick={() => setBorrador((b) => ({ ...b, dia: iso }))}
                      className={cn(
                        'mx-auto flex size-8 items-center justify-center rounded-full text-sm transition-colors disabled:pointer-events-none disabled:opacity-30',
                        elegido ? 'bg-bordo font-semibold text-white' : 'hover:bg-muted',
                        !elegido && iso === hoy && 'ring-1 ring-dorado',
                      )}
                    >
                      {fecha.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hora */}
            <div className="flex flex-col border-border sm:border-l sm:pl-4">
              <span className="mb-2 text-xs text-muted-foreground">Seleccionar hora</span>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-muted px-3 py-1.5 text-3xl tabular-nums">
                  {dosDigitos(borrador.hora12)}
                </span>
                <span className="text-2xl">:</span>
                <span className="rounded-lg bg-muted px-3 py-1.5 text-3xl tabular-nums">
                  {dosDigitos(borrador.minuto)}
                </span>
                <div className="ml-1 flex flex-col overflow-hidden rounded-lg ring-1 ring-border">
                  {(['AM', 'PM'] as const).map((sufijo) => {
                    const activo = (sufijo === 'PM') === borrador.pm;
                    return (
                      <button
                        key={sufijo}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => setBorrador((b) => ({ ...b, pm: sufijo === 'PM' }))}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium transition-colors',
                          activo
                            ? 'bg-bordo/10 text-bordo'
                            : 'text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {sufijo}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 flex justify-center gap-2">
                <ColumnaRueda
                  etiqueta="Hora"
                  opciones={HORAS}
                  elegida={borrador.hora12}
                  onElegir={(hora12) => setBorrador((b) => ({ ...b, hora12 }))}
                  formato={String}
                />
                <ColumnaRueda
                  etiqueta="Minutos"
                  opciones={MINUTOS}
                  elegida={borrador.minuto}
                  onElegir={(minuto) => setBorrador((b) => ({ ...b, minuto }))}
                  formato={dosDigitos}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={!borrador.dia} onClick={aceptar}>
              Aceptar
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
