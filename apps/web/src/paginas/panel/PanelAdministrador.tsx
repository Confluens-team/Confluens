import type { Rol, Sesion } from '@confluens/shared';
import {
  Building2,
  CalendarDays,
  Globe,
  Images,
  Inbox,
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
import { AdministrarLanding } from '@/paginas/salones/AdministrarLanding';
import { ConsultarSalones } from '@/paginas/salones/ConsultarSalones';
import { RegistrarServicio } from '@/paginas/servicios/RegistrarServicio';
import { ConsultasAdministrador } from './ConsultasAdministrador';

type Pestania = 'consultas' | 'agenda' | 'clientes' | 'catalogo' | 'cuenta';

const PESTANIAS: { valor: Pestania; texto: string; icono: typeof Inbox; bajada: string }[] = [
  {
    valor: 'consultas',
    texto: 'Consultas',
    icono: Inbox,
    bajada: 'Solicitudes recibidas: tomar la consulta, presupuestarla y reservar el evento.',
  },
  {
    valor: 'agenda',
    texto: 'Agenda',
    icono: CalendarDays,
    bajada: 'Eventos reservados y cobrados, con el estado de su seña.',
  },
  {
    valor: 'clientes',
    texto: 'Clientes',
    icono: Users,
    bajada: 'Clientes registrados y cargados por el equipo.',
  },
  {
    valor: 'catalogo',
    texto: 'Catálogo y landing',
    icono: UtensilsCrossed,
    bajada: 'Salones, servicios y contenido publicado en la landing.',
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

// Todo lo que se consulta o se carga del catálogo: salones (HU-03), servicios (HU-02) y el contenido
// de la landing (HU-08).
function CatalogoYLanding() {
  const [seccion, setSeccion] = useState<'salones' | 'servicios' | 'landing'>('servicios');
  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap rounded-lg bg-muted p-1">
        {(
          [
            { valor: 'salones', texto: 'Salones', icono: Building2 },
            { valor: 'servicios', texto: 'Servicios', icono: UtensilsCrossed },
            { valor: 'landing', texto: 'Fotos y visibilidad en la landing', icono: Images },
          ] as const
        ).map(({ valor, texto, icono: Icono }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setSeccion(valor)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              seccion === valor ? 'bg-card shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Icono className="size-4" /> {texto}
          </button>
        ))}
      </div>
      <div className="rounded-xl bg-card ring-1 ring-border">
        {seccion === 'salones' && <ConsultarSalones />}
        {seccion === 'servicios' && <RegistrarServicio />}
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

// Panel del Administrador del Sistema: todo lo implementado hasta el Sprint 1 en cinco pestañas,
// usando solo lo que ya expone la API. El administrador puede hacer todo lo que hace el Responsable
// de Eventos, además de administrar la landing. Cada pestaña es una ruta: /admin/<pestaña>.
export function PanelAdministrador({ sesion }: { sesion: Sesion }) {
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
      <header className="sticky top-0 z-40 border-b border-border/70 bg-papel/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo compacto />
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
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6" role="tablist">
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

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-bordo">{activa.texto}</h1>
          <p className="text-sm text-muted-foreground">{activa.bajada}</p>
        </div>
        {pestania === 'consultas' && <ConsultasAdministrador />}
        {pestania === 'agenda' && <Agenda />}
        {pestania === 'clientes' && <ListadoClientes />}
        {pestania === 'catalogo' && <CatalogoYLanding />}
        {pestania === 'cuenta' && <MiCuenta sesion={sesion} onCerrarSesion={salir} />}
      </main>
    </div>
  );
}
