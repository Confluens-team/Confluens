import type { Rol, Sesion } from '@confluens/shared';
import {
  Building2,
  CalendarDays,
  CreditCard,
  Globe,
  Images,
  Inbox,
  List,
  LogOut,
  Settings,
  UserRound,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useCerrarSesion } from '@/hooks/use-sesion';
import { cn } from '@/lib/utils';
import { ListadoClientes } from '@/paginas/clientes/ListadoClientes';
import { Agenda } from '@/paginas/eventos/Agenda';
import { RegistrarMedioPago } from '@/paginas/medios-pago/RegistrarMedioPago';
import { AdministrarLanding } from '@/paginas/salones/AdministrarLanding';
import { ConsultarSalones } from '@/paginas/salones/ConsultarSalones';
import { ListadoConsultas } from '@/paginas/presupuestos/ListadoConsultas';
import { RegistrarServicio } from '@/paginas/servicios/RegistrarServicio';

type Pestania = 'agenda' | 'eventos' | 'consultas' | 'clientes' | 'configuracion' | 'cuenta';

// La agenda va primero: es la pestaña de inicio del panel (decisión de Franco, 16/10/2026).
const PESTANIAS: { valor: Pestania; texto: string; icono: typeof Inbox; bajada: string }[] = [
  {
    valor: 'agenda',
    texto: 'Agenda',
    icono: CalendarDays,
    bajada: 'Calendario de eventos por mes, semana y día, con filtros por salón y por estado.',
  },
  {
    valor: 'eventos',
    texto: 'Eventos',
    icono: List,
    bajada: 'Todos los eventos agrupados por mes, con filtros por salón y por estado.',
  },
  {
    valor: 'consultas',
    texto: 'Consultas',
    icono: Inbox,
    bajada: 'Presupuestos pedidos por los clientes que todavía no se confirmaron.',
  },
  {
    valor: 'clientes',
    texto: 'Clientes',
    icono: Users,
    bajada: 'Clientes registrados y cargados por el equipo.',
  },
  {
    valor: 'configuracion',
    texto: 'Configuración de negocio',
    icono: Settings,
    bajada: 'Salones, servicios, medios de pago y contenido publicado en la landing.',
  },
  {
    valor: 'cuenta',
    texto: 'Mi cuenta',
    icono: UserRound,
    bajada: 'Datos de la cuenta con la que iniciaste sesión.',
  },
];

const NOMBRES_DE_ROL: Record<Rol, string> = {
  RESPONSABLE_EVENTOS: 'Responsable de Eventos',
  RESPONSABLE_FINANZAS: 'Responsable de Finanzas',
  GERENTE_GENERAL: 'Gerente General',
  ADMINISTRADOR_SISTEMA: 'Administrador del Sistema',
  CLIENTE: 'Cliente',
};

type SeccionConfiguracion = 'salones' | 'servicios' | 'medios' | 'landing';

// Las secciones de la configuración, agrupadas como en el sidebar.
const GRUPOS_DE_CONFIGURACION: {
  titulo: string;
  secciones: { valor: SeccionConfiguracion; texto: string; icono: typeof Inbox }[];
}[] = [
  { titulo: 'Negocio', secciones: [{ valor: 'salones', texto: 'Salones', icono: Building2 }] },
  {
    titulo: 'Catálogo',
    secciones: [{ valor: 'servicios', texto: 'Servicios y precios', icono: UtensilsCrossed }],
  },
  {
    titulo: 'Cobros',
    secciones: [{ valor: 'medios', texto: 'Medios de pago', icono: CreditCard }],
  },
  {
    titulo: 'Sitio web',
    secciones: [{ valor: 'landing', texto: 'Landing y fotos', icono: Images }],
  },
];

// Todo lo que se consulta o se carga del catálogo: salones (HU-03), servicios (HU-02), medios de pago
// (HU-19) y el contenido de la landing (HU-08). Cada sección se elige desde el sidebar de la
// izquierda; en pantallas angostas el sidebar va arriba.
function ConfiguracionDeNegocio() {
  const [seccion, setSeccion] = useState<SeccionConfiguracion>('servicios');
  return (
    <div className="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
      {/* top-32: deja libre el encabezado fijo del panel con sus pestañas. */}
      <nav
        aria-label="Secciones de la configuración"
        className="space-y-4 rounded-xl bg-card p-2 ring-1 ring-border md:sticky md:top-32"
      >
        {GRUPOS_DE_CONFIGURACION.map(({ titulo, secciones }) => (
          <div key={titulo} className="space-y-1">
            <p className="px-3 pt-2 text-[0.65rem] font-semibold tracking-[0.15em] text-dorado-texto uppercase">
              {titulo}
            </p>
            {secciones.map(({ valor, texto, icono: Icono }) => (
              <button
                key={valor}
                type="button"
                aria-current={seccion === valor ? 'page' : undefined}
                onClick={() => setSeccion(valor)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                  seccion === valor ? 'bg-secondary text-bordo' : 'text-foreground hover:bg-muted',
                )}
              >
                <Icono className="size-4 shrink-0" /> {texto}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="rounded-xl bg-card ring-1 ring-border">
        {seccion === 'salones' && <ConsultarSalones />}
        {seccion === 'servicios' && <RegistrarServicio />}
        {seccion === 'medios' && <RegistrarMedioPago />}
        {seccion === 'landing' && <AdministrarLanding />}
      </div>
    </div>
  );
}

function MiCuenta({ sesion, onCerrarSesion }: { sesion: Sesion; onCerrarSesion: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl bg-card p-6 ring-1 ring-border">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-bordo font-serif text-lg text-crema uppercase">
            {sesion.email.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{sesion.email}</p>
            <p className="text-sm text-muted-foreground">{NOMBRES_DE_ROL[sesion.rol]}</p>
          </div>
        </div>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate">{sesion.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Rol</dt>
            <dd>{NOMBRES_DE_ROL[sesion.rol]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Sesión</dt>
            <dd>Se cierra sola tras 2 horas sin actividad</dd>
          </div>
        </dl>
        <Button variant="outline" className="mt-6" onClick={onCerrarSesion}>
          <LogOut /> Cerrar sesión
        </Button>
      </section>

      <section className="rounded-xl border border-dashed bg-card p-6">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-dorado" />
          <h3 className="font-medium">Opciones de la cuenta</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Acá se van a sumar las opciones que agreguemos más adelante, como cambiar la contraseña o
          administrar los usuarios del sistema.
        </p>
      </section>
    </div>
  );
}

// Panel interno: una sola vista para todo el personal, con todo lo implementado en seis pestañas.
// Por ahora todos los roles ven las mismas pestañas; qué ve cada uno se revisa más adelante, y
// mientras tanto los permisos los aplica la API. Cada pestaña es una ruta: /admin/<pestaña>.
export function PanelInterno({ sesion }: { sesion: Sesion }) {
  const navigate = useNavigate();
  const cerrarSesion = useCerrarSesion();
  const pestania = useParams()['pestania'] as Pestania | undefined;
  const activa = PESTANIAS.find((p) => p.valor === pestania);

  // Primero se sale a la landing y después se cierra la sesión: si fuera al revés, la ruta /admin
  // se quedaría sin sesión y redirigiría al login del personal.
  function salir() {
    navigate('/');
    cerrarSesion.mutate();
  }

  // /admin sin pestaña, o con una que no existe, abre la agenda.
  if (!activa) return <Navigate to="/admin/agenda" replace />;

  return (
    <div className="fondo-papel min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-papel/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6">
          {/* El logo vuelve al inicio del panel, que es la agenda. */}
          <button
            type="button"
            onClick={() => navigate('/admin/agenda')}
            aria-label="Ir a la agenda"
            className="rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Logo compacto />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{sesion.email}</span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <Globe /> Ver la landing
            </Button>
            <Button variant="outline" size="sm" onClick={salir} disabled={cerrarSesion.isPending}>
              <LogOut /> Salir
            </Button>
          </div>
        </div>
        {/* overflow-y-hidden: el -mb-px de las pestañas dejaba el contenido 1px más alto que la
            barra y aparecía una barra de scroll vertical. En pantallas angostas se sigue pudiendo
            deslizar de costado, sin mostrar la barra. */}
        <nav
          className="mx-auto flex max-w-[90rem] gap-1 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {PESTANIAS.map(({ valor, texto, icono: Icono }) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={pestania === valor}
              onClick={() => navigate(`/admin/${valor}`)}
              className={cn(
                '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                pestania === valor
                  ? 'border-bordo text-bordo'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icono className="size-4" /> {texto}
            </button>
          ))}
        </nav>
      </header>

      {/* 90rem y no el max-w-6xl del sitio público: la tabla de consultas es la pantalla más ancha
          del panel y con 72rem no entraba sin scroll horizontal. El encabezado y las pestañas usan
          el mismo ancho para que el borde inferior de la pestaña activa siga alineado con el
          contenido. */}
      <main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 print:max-w-none print:p-0">
        <div className="mb-6 print:hidden">
          <h1 className="text-2xl font-semibold text-bordo">{activa.texto}</h1>
          <p className="text-sm text-muted-foreground">{activa.bajada}</p>
        </div>
        {/* La key separa el estado de las dos pestañas: cada una conserva sus propios filtros y el
            evento abierto en una no aparece en la otra. */}
        {pestania === 'agenda' && <Agenda key="agenda" vista="calendario" />}
        {pestania === 'eventos' && <Agenda key="eventos" vista="lista" />}
        {pestania === 'consultas' && <ListadoConsultas />}
        {pestania === 'clientes' && <ListadoClientes />}
        {pestania === 'configuracion' && <ConfiguracionDeNegocio />}
        {pestania === 'cuenta' && <MiCuenta sesion={sesion} onCerrarSesion={salir} />}
      </main>
    </div>
  );
}
