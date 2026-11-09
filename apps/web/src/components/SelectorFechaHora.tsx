import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Selectores de día y hora con el mismo diseño en toda la app: un calendario mensual y la hora en
// formato de 12 horas con AM/PM (columnas de hora y minutos). Reemplazan a los <input type="date">,
// "time" y "datetime-local", que cada navegador dibuja distinto.
//
// - SelectorFechaHora: día y hora juntos, con el valor de un datetime-local ("YYYY-MM-DDTHH:mm" en
//   la hora local), para que quien lo usa lo convierta a ISO igual que antes. Lo usa el horario
//   del evento en el panel.
// - SelectorFecha ("YYYY-MM-DD") y SelectorHora ("HH:mm"): cada uno por separado, con los mismos
//   valores que el input nativo que reemplazan. Los usa el cotizador del cliente.
//
// Sin dependencias nuevas: Popover de radix-ui (ya instalado) y la grilla del mes armada a mano.

const DIAS_SEMANA = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
const HORAS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
// De a 5 minutos: un evento no arranca a las 21:07, y la columna queda corta.
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5);

const formateadorMes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
// Para leer en voz alta cada día del calendario (aria-label): "vie, 30 abr 2027".
const formateadorDia = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
// Lo que muestra el selector ya elegido: siempre dd/mm/aaaa, como todas las fechas del sistema.
const formateadorFecha = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
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

// "HH:mm" en 24 horas, como el valor de un <input type="time">.
function aHora({ hora12, minuto, pm }: Pick<Borrador, 'hora12' | 'minuto' | 'pm'>): string {
  return `${dosDigitos((hora12 % 12) + (pm ? 12 : 0))}:${dosDigitos(minuto)}`;
}

function aValor(borrador: Borrador): string {
  return `${borrador.dia}T${aHora(borrador)}`;
}

function textoDelValor(valor: string): string {
  const { dia, hora12, minuto, pm } = aBorrador(valor, '', '');
  return `${formateadorFecha.format(deDiaISO(dia))} · ${hora12}:${dosDigitos(minuto)} ${pm ? 'PM' : 'AM'}`;
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

// El botón que abre el popover: se ve como un Input. `className` ajusta el alto o el ancho.
function Disparador({
  id,
  texto,
  vacio,
  className,
  icono: Icono = CalendarDays,
}: {
  id?: string;
  texto: string;
  vacio: boolean;
  className?: string;
  icono?: typeof CalendarDays;
}) {
  return (
    <Popover.Trigger asChild>
      <button
        id={id}
        type="button"
        className={cn(
          'flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30',
          className,
        )}
      >
        <span className={cn('truncate', vacio && 'text-muted-foreground')}>{texto}</span>
        <Icono className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </Popover.Trigger>
  );
}

function Contenido({ children }: { children: React.ReactNode }) {
  return (
    <Popover.Portal>
      <Popover.Content
        align="start"
        sideOffset={6}
        collisionPadding={16}
        className="z-50 rounded-xl bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-border"
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  );
}

function Calendario({
  dia,
  onElegir,
  mesVisible,
  onCambiarMes,
  diaMinimo,
}: {
  dia: string;
  onElegir: (dia: string) => void;
  mesVisible: Date;
  onCambiarMes: (mes: Date) => void;
  diaMinimo?: string;
}) {
  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();
  const hoy = diaISO(new Date());

  return (
    <div className="w-64">
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Mes anterior"
          onClick={() => onCambiarMes(new Date(anio, mes - 1, 1))}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium capitalize">{formateadorMes.format(mesVisible)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Mes siguiente"
          onClick={() => onCambiarMes(new Date(anio, mes + 1, 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {DIAS_SEMANA.map((nombre) => (
          <span key={nombre} className="py-1 text-muted-foreground">
            {nombre}
          </span>
        ))}
        {celdasDelMes(anio, mes).map((fecha, i) => {
          if (!fecha) return <span key={`hueco-${i}`} />;
          const iso = diaISO(fecha);
          const elegido = iso === dia;
          const deshabilitado = diaMinimo !== undefined && iso < diaMinimo;
          return (
            <button
              key={iso}
              type="button"
              disabled={deshabilitado}
              aria-pressed={elegido}
              aria-label={formateadorDia.format(fecha)}
              onClick={() => onElegir(iso)}
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
  );
}

type HoraDelBorrador = Pick<Borrador, 'hora12' | 'minuto' | 'pm'>;

function Reloj({
  hora,
  onCambiar,
  className,
}: {
  hora: HoraDelBorrador;
  onCambiar: (cambio: Partial<HoraDelBorrador>) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="mb-2 text-xs text-muted-foreground">Seleccionar hora</span>
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-muted px-3 py-1.5 text-3xl tabular-nums">
          {dosDigitos(hora.hora12)}
        </span>
        <span className="text-2xl">:</span>
        <span className="rounded-lg bg-muted px-3 py-1.5 text-3xl tabular-nums">
          {dosDigitos(hora.minuto)}
        </span>
        <div className="ml-1 flex flex-col overflow-hidden rounded-lg ring-1 ring-border">
          {(['AM', 'PM'] as const).map((sufijo) => {
            const activo = (sufijo === 'PM') === hora.pm;
            return (
              <button
                key={sufijo}
                type="button"
                aria-pressed={activo}
                onClick={() => onCambiar({ pm: sufijo === 'PM' })}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium transition-colors',
                  activo ? 'bg-bordo/10 text-bordo' : 'text-muted-foreground hover:bg-muted',
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
          elegida={hora.hora12}
          onElegir={(hora12) => onCambiar({ hora12 })}
          formato={String}
        />
        <ColumnaRueda
          etiqueta="Minutos"
          opciones={MINUTOS}
          elegida={hora.minuto}
          onElegir={(minuto) => onCambiar({ minuto })}
          formato={dosDigitos}
        />
      </div>
    </div>
  );
}

function Botones({
  onCancelar,
  onAceptar,
  aceptarDeshabilitado,
  onQuitar,
}: {
  onCancelar: () => void;
  onAceptar: () => void;
  aceptarDeshabilitado?: boolean;
  onQuitar?: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      {onQuitar && (
        <Button type="button" variant="ghost" size="sm" className="mr-auto" onClick={onQuitar}>
          Quitar
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
        Cancelar
      </Button>
      <Button type="button" size="sm" disabled={aceptarDeshabilitado} onClick={onAceptar}>
        Aceptar
      </Button>
    </div>
  );
}

const mesDe = (dia: string) => {
  const fecha = deDiaISO(dia);
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
};

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
      setMesVisible(mesDe(inicial.dia || diaSugerido));
    }
    setAbierto(estado);
  }

  function aceptar() {
    if (!borrador.dia) return;
    onChange(aValor(borrador));
    setAbierto(false);
  }

  return (
    <Popover.Root open={abierto} onOpenChange={abrir}>
      <Disparador id={id} texto={value ? textoDelValor(value) : placeholder} vacio={!value} />
      <Contenido>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Calendario
            dia={borrador.dia}
            onElegir={(dia) => setBorrador((b) => ({ ...b, dia }))}
            mesVisible={mesVisible}
            onCambiarMes={setMesVisible}
            diaMinimo={diaMinimo}
          />
          <Reloj
            hora={borrador}
            onCambiar={(cambio) => setBorrador((b) => ({ ...b, ...cambio }))}
            className="border-border sm:border-l sm:pl-4"
          />
        </div>
        <Botones
          onCancelar={() => setAbierto(false)}
          onAceptar={aceptar}
          aceptarDeshabilitado={!borrador.dia}
        />
      </Contenido>
    </Popover.Root>
  );
}

interface SelectorFechaProps {
  id?: string;
  // "YYYY-MM-DD" o '' sin elegir, como un <input type="date">.
  value: string;
  onChange: (valor: string) => void;
  diaMinimo?: string;
  placeholder?: string;
  className?: string;
}

// Solo el día: se elige con un clic en el calendario, sin botón de aceptar.
export function SelectorFecha({
  id,
  value,
  onChange,
  diaMinimo,
  placeholder = 'Elegir día',
  className,
}: SelectorFechaProps) {
  const [abierto, setAbierto] = useState(false);
  const [mesVisible, setMesVisible] = useState(() => new Date());

  function abrir(estado: boolean) {
    if (estado) setMesVisible(mesDe(value || diaMinimo || diaISO(new Date())));
    setAbierto(estado);
  }

  return (
    <Popover.Root open={abierto} onOpenChange={abrir}>
      <Disparador
        id={id}
        texto={value ? formateadorFecha.format(deDiaISO(value)) : placeholder}
        vacio={!value}
        className={className}
      />
      <Contenido>
        <Calendario
          dia={value}
          onElegir={(dia) => {
            onChange(dia);
            setAbierto(false);
          }}
          mesVisible={mesVisible}
          onCambiarMes={setMesVisible}
          diaMinimo={diaMinimo}
        />
      </Contenido>
    </Popover.Root>
  );
}

interface SelectorHoraProps {
  id?: string;
  // "HH:mm" o '' sin elegir, como un <input type="time">.
  value: string;
  onChange: (valor: string) => void;
  // Hora que se propone al abrir si todavía no hay valor.
  horaSugerida?: string;
  // Muestra «Quitar» para dejarla vacía otra vez (una hora opcional).
  opcional?: boolean;
  placeholder?: string;
  className?: string;
}

export function SelectorHora({
  id,
  value,
  onChange,
  horaSugerida = '12:00',
  opcional = false,
  placeholder = 'Elegir hora',
  className,
}: SelectorHoraProps) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(() => aBorrador('', '', value || horaSugerida));

  function abrir(estado: boolean) {
    if (estado) setBorrador(aBorrador('', '', value || horaSugerida));
    setAbierto(estado);
  }

  function aceptar() {
    onChange(aHora(borrador));
    setAbierto(false);
  }

  const { hora12, minuto, pm } = aBorrador('', '', value || '00:00');
  return (
    <Popover.Root open={abierto} onOpenChange={abrir}>
      <Disparador
        id={id}
        texto={value ? `${hora12}:${dosDigitos(minuto)} ${pm ? 'PM' : 'AM'}` : placeholder}
        vacio={!value}
        className={className}
        icono={Clock}
      />
      <Contenido>
        <Reloj hora={borrador} onCambiar={(cambio) => setBorrador((b) => ({ ...b, ...cambio }))} />
        <Botones
          onCancelar={() => setAbierto(false)}
          onAceptar={aceptar}
          onQuitar={
            opcional && value
              ? () => {
                  onChange('');
                  setAbierto(false);
                }
              : undefined
          }
        />
      </Contenido>
    </Popover.Root>
  );
}
