import type { Solicitud } from '@confluens/shared';
import { useState } from 'react';

import { EncabezadoSitio } from '@/components/EncabezadoSitio';
import { useCerrarSesion, useSesion } from '@/hooks/use-sesion';
import { DetalleEvento } from '@/paginas/eventos/DetalleEvento';
import { TomarConsulta } from '@/paginas/eventos/TomarConsulta';
import { AccesoCliente } from '@/paginas/auth/AccesoCliente';
import { IniciarSesion } from '@/paginas/auth/IniciarSesion';
import { Panel } from '@/paginas/panel/Panel';
import { PanelAdministrador } from '@/paginas/panel/PanelAdministrador';
import { CotizarEvento, type ResultadoCotizacion } from '@/paginas/presupuestos/CotizarEvento';
import { PresupuestoEstimado } from '@/paginas/presupuestos/PresupuestoEstimado';
import { RegistrarServicio } from '@/paginas/servicios/RegistrarServicio';
import { Landing } from '@/paginas/solicitudes/Landing';
import { ListadoSolicitudes } from '@/paginas/solicitudes/ListadoSolicitudes';

type Vista =
  | { tipo: 'publica' }
  | { tipo: 'cotizar'; salonId?: number }
  | { tipo: 'presupuesto-generado'; resultado: ResultadoCotizacion }
  | { tipo: 'interna' }
  | { tipo: 'servicios' }
  | { tipo: 'tomar-consulta'; solicitud?: Solicitud }
  | { tipo: 'detalle-evento'; eventoId: number };

// Montaje temporal, todavía sin router (ADR 0002). Al integrar HU-27 con HU-14/HU-15/HU-32 el
// canal público (landing + formulario de consulta, que no requiere sesión por el criterio 2 de
// HU-14) queda separado del interno, que ahora sí pasa por el login y el panel por rol de HU-27.
// Las pantallas internas se alcanzan desde el conmutador de abajo: los ítems del menú de Panel
// siguen sin rutear (eso es HU-28), así que no se los toca acá.
export default function App() {
  const { data: sesion, isLoading } = useSesion();
  const cerrarSesion = useCerrarSesion();
  const [vista, setVista] = useState<Vista>({ tipo: 'publica' });
  // Modal de acceso del cliente, con el salón desde el que se abrió (criterio 3 de HU-07).
  const [acceso, setAcceso] = useState<{ abierto: boolean; salonId?: number }>({
    abierto: false,
  });
  const sesionCliente = sesion?.rol === 'CLIENTE' ? sesion : null;

  function irA(nueva: Vista) {
    setVista(nueva);
    window.scrollTo({ top: 0 });
  }

  // "Consultá para hacer tu evento": el cotizador con precios pide la cuenta del cliente. Con la
  // sesión ya iniciada va directo; si no, abre el modal y sigue al cotizador al ingresar.
  function cotizar(salonId?: number) {
    if (sesionCliente) {
      irA({ tipo: 'cotizar', salonId });
    } else {
      setAcceso({ abierto: true, salonId });
    }
  }

  // Mientras se resuelve GET /auth/yo no se sabe todavía si hay sesión: mostrar
  // login prematuramente causaría un parpadeo (login → panel) en cada recarga de
  // página para un usuario que sí tiene sesión vigente.
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  if (
    vista.tipo === 'publica' ||
    vista.tipo === 'cotizar' ||
    vista.tipo === 'presupuesto-generado'
  ) {
    // Sin sesión de cliente (por ejemplo, después de "Salir") el cotizador vuelve a la landing.
    const vistaPublica = sesionCliente ? vista : { tipo: 'publica' as const };
    return (
      <div className="min-h-screen bg-background text-foreground">
        <EncabezadoSitio
          enLanding={vistaPublica.tipo === 'publica'}
          sesionCliente={sesionCliente}
          onInicio={() => irA({ tipo: 'publica' })}
          onCotizar={() => cotizar()}
          onCerrarSesion={() =>
            cerrarSesion.mutate(undefined, { onSuccess: () => irA({ tipo: 'publica' }) })
          }
        />
        {vistaPublica.tipo === 'publica' && (
          <Landing onCotizar={cotizar} onAccesoPersonal={() => irA({ tipo: 'interna' })} />
        )}
        {vistaPublica.tipo === 'cotizar' && (
          <CotizarEvento
            key={vistaPublica.salonId ?? 'sin-salon'}
            salonInicialId={vistaPublica.salonId}
            onGenerado={(resultado) => irA({ tipo: 'presupuesto-generado', resultado })}
          />
        )}
        {vistaPublica.tipo === 'presupuesto-generado' && (
          <PresupuestoEstimado
            resultado={vistaPublica.resultado}
            onOtro={() => irA({ tipo: 'cotizar' })}
            onInicio={() => irA({ tipo: 'publica' })}
          />
        )}
        <AccesoCliente
          abierto={acceso.abierto}
          onCerrar={() => setAcceso({ abierto: false })}
          onIngreso={() => {
            setAcceso({ abierto: false });
            irA({ tipo: 'cotizar', salonId: acceso.salonId });
          }}
        />
      </div>
    );
  }

  // Una sesión de cliente no da acceso al canal interno: se pide el login del personal.
  if (!sesion || sesion.rol === 'CLIENTE') {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex justify-start border-b bg-card p-2 text-xs">
          <button
            className="underline underline-offset-2"
            onClick={() => setVista({ tipo: 'publica' })}
          >
            ← Volver al sitio público
          </button>
        </div>
        <IniciarSesion />
      </div>
    );
  }

  // El Administrador del Sistema tiene su propio panel con pestañas: todo lo hecho hasta ahora.
  if (sesion.rol === 'ADMINISTRADOR_SISTEMA') {
    return <PanelAdministrador sesion={sesion} onVistaPublica={() => irA({ tipo: 'publica' })} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Panel sesion={sesion} />
      <div className="flex justify-center gap-2 border-t bg-card p-2 text-xs">
        <button
          className="underline underline-offset-2"
          onClick={() => setVista({ tipo: 'interna' })}
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
        <button
          className="underline underline-offset-2"
          onClick={() => setVista({ tipo: 'publica' })}
        >
          Vista pública
        </button>
      </div>
      {vista.tipo === 'interna' && (
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
