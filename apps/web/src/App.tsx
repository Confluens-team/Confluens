import type { Sesion, Solicitud } from '@confluens/shared';
import { useEffect, useState } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router';

import { EncabezadoSitio } from '@/components/EncabezadoSitio';
import { useCerrarSesion, useSesion } from '@/hooks/use-sesion';
import { AccesoCliente } from '@/paginas/auth/AccesoCliente';
import { IniciarSesion } from '@/paginas/auth/IniciarSesion';
import { DetalleEvento } from '@/paginas/eventos/DetalleEvento';
import { TomarConsulta } from '@/paginas/eventos/TomarConsulta';
import { Panel } from '@/paginas/panel/Panel';
import { PanelAdministrador } from '@/paginas/panel/PanelAdministrador';
import { CotizarEvento, type ResultadoCotizacion } from '@/paginas/presupuestos/CotizarEvento';
import { PresupuestoEstimado } from '@/paginas/presupuestos/PresupuestoEstimado';
import { RegistrarServicio } from '@/paginas/servicios/RegistrarServicio';
import { Landing } from '@/paginas/solicitudes/Landing';
import { ListadoSolicitudes } from '@/paginas/solicitudes/ListadoSolicitudes';

// Rutas de la web (ADR 0005, reemplaza a la 0002):
//   /             landing pública
//   /cotizar      cotizador del cliente registrado (?salon=<id> lo preselecciona)
//   /presupuesto  presupuesto recién generado (viaja en el state de la navegación)
//   /acceso       login del personal
//   /admin/:tab   panel del Administrador del Sistema (consultas, agenda, clientes, catalogo, cuenta)
//   /panel        panel del resto del personal
// Las rutas son solo de navegación: los permisos reales los aplica la API.

const esPersonal = (sesion: Sesion | null | undefined): sesion is Sesion =>
  !!sesion && sesion.rol !== 'CLIENTE';

// Destino del personal según el rol.
const inicioDelPersonal = (sesion: Sesion) =>
  sesion.rol === 'ADMINISTRADOR_SISTEMA' ? '/admin' : '/panel';

// Cada navegación arranca arriba de la página, como antes con irA().
function VolverArriba() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Sin return: en algunos navegadores scrollTo devuelve una promesa, y React tomaría eso como
    // la función de limpieza del efecto.
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

// Canal público: encabezado del sitio, la pantalla de la ruta y el modal de acceso del cliente.
function SitioPublico({ sesionCliente }: { sesionCliente: Sesion | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cerrarSesion = useCerrarSesion();
  // Modal de acceso con el salón desde el que se abrió (criterio 3 de HU-07).
  const [acceso, setAcceso] = useState<{ abierto: boolean; salonId?: number }>({
    abierto: false,
  });

  // /cotizar sin sesión de cliente redirige acá con el pedido de acceso en el state: el modal
  // también se abre por eso, y al cerrarlo se limpia el state.
  const pedido = location.state as { pedirAcceso?: boolean; salonId?: number } | null;
  const accesoAbierto = acceso.abierto || !!pedido?.pedirAcceso;
  const salonDelAcceso = acceso.abierto ? acceso.salonId : pedido?.salonId;
  function cerrarAcceso() {
    setAcceso({ abierto: false });
    if (pedido?.pedirAcceso) navigate(location.pathname, { replace: true, state: null });
  }

  const irACotizar = (salonId?: number) =>
    navigate(salonId ? `/cotizar?salon=${salonId}` : '/cotizar');

  // "Consultá para hacer tu evento": con la sesión del cliente va directo al cotizador; si no,
  // abre el modal y sigue al cotizador al ingresar.
  function cotizar(salonId?: number) {
    if (sesionCliente) irACotizar(salonId);
    else setAcceso({ abierto: true, salonId });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EncabezadoSitio
        enLanding={location.pathname === '/'}
        sesionCliente={sesionCliente}
        onInicio={() => navigate('/')}
        onCotizar={() => cotizar()}
        onCerrarSesion={() => cerrarSesion.mutate(undefined, { onSuccess: () => navigate('/') })}
      />
      <Outlet context={{ cotizar }} />
      <AccesoCliente
        abierto={accesoAbierto}
        onCerrar={cerrarAcceso}
        onIngreso={() => {
          setAcceso({ abierto: false });
          irACotizar(salonDelAcceso);
        }}
      />
    </div>
  );
}

function RutaCotizar({ sesionCliente }: { sesionCliente: Sesion | null }) {
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const salonId = Number(parametros.get('salon')) || undefined;

  if (!sesionCliente) return <Navigate to="/" replace state={{ pedirAcceso: true, salonId }} />;
  return (
    <CotizarEvento
      key={salonId ?? 'sin-salon'}
      salonInicialId={salonId}
      onGenerado={(resultado) => navigate('/presupuesto', { state: resultado })}
    />
  );
}

// El presupuesto generado no se vuelve a pedir a la API: llega en el state de la navegación. Si se
// entra directo (o se recarga), no hay nada que mostrar y se vuelve al cotizador.
function RutaPresupuesto({ sesionCliente }: { sesionCliente: Sesion | null }) {
  const navigate = useNavigate();
  const resultado = useLocation().state as ResultadoCotizacion | null;

  if (!sesionCliente || !resultado) return <Navigate to="/cotizar" replace />;
  return (
    <PresupuestoEstimado
      resultado={resultado}
      onOtro={() => navigate('/cotizar')}
      onInicio={() => navigate('/')}
    />
  );
}

function RutaLanding() {
  const navigate = useNavigate();
  // cotizar() viene de SitioPublico por el <Outlet>: es el que sabe abrir el modal de acceso.
  const { cotizar } = useOutletContext<{ cotizar: (salonId?: number) => void }>();
  return <Landing onCotizar={cotizar} onAccesoPersonal={() => navigate('/acceso')} />;
}

type VistaPersonal =
  | { tipo: 'solicitudes' }
  | { tipo: 'servicios' }
  | { tipo: 'tomar-consulta'; solicitud?: Solicitud }
  | { tipo: 'detalle-evento'; eventoId: number };

// Panel del resto del personal: el menú por rol de HU-27 más el conmutador a las pantallas del
// circuito de consultas y servicios.
function PanelPersonal({ sesion }: { sesion: Sesion }) {
  const navigate = useNavigate();
  const [vista, setVista] = useState<VistaPersonal>({ tipo: 'solicitudes' });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Panel sesion={sesion} />
      <div className="flex justify-center gap-2 border-t bg-card p-2 text-xs">
        <button
          className="underline underline-offset-2"
          onClick={() => setVista({ tipo: 'solicitudes' })}
        >
          Solicitudes
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          className="underline underline-offset-2"
          onClick={() => setVista({ tipo: 'servicios' })}
        >
          Servicios
        </button>
        <span className="text-muted-foreground">·</span>
        <button className="underline underline-offset-2" onClick={() => navigate('/')}>
          Vista pública
        </button>
      </div>
      {vista.tipo === 'solicitudes' && (
        <ListadoSolicitudes
          onTomar={(solicitud) => setVista({ tipo: 'tomar-consulta', solicitud })}
        />
      )}
      {vista.tipo === 'servicios' && <RegistrarServicio />}
      {vista.tipo === 'tomar-consulta' && (
        <TomarConsulta
          solicitud={vista.solicitud}
          onCreado={(eventoId) => setVista({ tipo: 'detalle-evento', eventoId })}
        />
      )}
      {vista.tipo === 'detalle-evento' && <DetalleEvento eventoId={vista.eventoId} />}
    </div>
  );
}

function RutaAcceso({ sesion }: { sesion: Sesion | null | undefined }) {
  const navigate = useNavigate();
  // Con la sesión del personal ya iniciada (también justo después del login) va a su panel.
  if (esPersonal(sesion)) return <Navigate to={inicioDelPersonal(sesion)} replace />;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex justify-start border-b bg-card p-2 text-xs">
        <button className="underline underline-offset-2" onClick={() => navigate('/')}>
          ← Volver al sitio público
        </button>
      </div>
      <IniciarSesion />
    </div>
  );
}

export default function App() {
  const { data: sesion, isLoading } = useSesion();
  const sesionCliente = sesion?.rol === 'CLIENTE' ? sesion : null;

  // Mientras se resuelve GET /auth/yo no se sabe todavía si hay sesión: decidir la ruta antes
  // causaría un parpadeo (login → panel) en cada recarga para quien sí tiene sesión vigente.
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  return (
    <>
      <VolverArriba />
      <Routes>
        <Route element={<SitioPublico sesionCliente={sesionCliente} />}>
          <Route index element={<RutaLanding />} />
          <Route path="cotizar" element={<RutaCotizar sesionCliente={sesionCliente} />} />
          <Route path="presupuesto" element={<RutaPresupuesto sesionCliente={sesionCliente} />} />
        </Route>

        <Route path="acceso" element={<RutaAcceso sesion={sesion} />} />

        <Route
          path="admin/:pestania?"
          element={
            sesion?.rol === 'ADMINISTRADOR_SISTEMA' ? (
              <PanelAdministrador sesion={sesion} />
            ) : (
              <Navigate to="/acceso" replace />
            )
          }
        />

        <Route
          path="panel"
          element={
            !esPersonal(sesion) ? (
              <Navigate to="/acceso" replace />
            ) : sesion.rol === 'ADMINISTRADOR_SISTEMA' ? (
              <Navigate to="/admin" replace />
            ) : (
              <PanelPersonal sesion={sesion} />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
