import { LayoutDashboard, ListChecks } from 'lucide-react';
import { useState } from 'react';

import { Pestanias } from '@/components/Pestanias';
import { AuditoriaRegistro } from './AuditoriaRegistro';
import { AuditoriaResumen } from './AuditoriaResumen';

type Vista = 'resumen' | 'registro';

/**
 * HU-25 del backlog, Auditoría para Gerencia (15/11/2026): la pestaña Auditoría de Configuración de
 * negocio, solo para el GG y el ADM (la API se la niega al resto). Dos vistas: el Resumen de la
 * última semana con lo que espera revisión (diseño B) y el Registro filtrable con el detalle de cada
 * cambio (diseño A). Es de solo lectura: el registro no se modifica ni se borra; lo único que se
 * guarda es la revisión del Gerente General.
 */
export function Auditoria() {
  const [vista, setVista] = useState<Vista>('resumen');
  // «Ver todos en Registro» abre el Registro filtrado por lo que espera revisión.
  const [soloPendientes, setSoloPendientes] = useState(false);

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl min-w-0 flex-[1_1_20rem]">
          <h2 className="text-lg font-medium">Auditoría</h2>
          <p className="text-sm text-muted-foreground">
            Cada cambio en el panel: qué se modificó, quién lo hizo y cuándo. «Sistema» son las
            tareas automáticas, como el vencimiento de los presupuestos.
          </p>
        </div>
        <Pestanias<Vista>
          etiqueta="Vistas de la auditoría"
          valor={vista}
          onCambiar={(nueva) => {
            setSoloPendientes(false);
            setVista(nueva);
          }}
          pestanias={[
            { valor: 'resumen', texto: 'Resumen', icono: LayoutDashboard },
            { valor: 'registro', texto: 'Registro', icono: ListChecks },
          ]}
        />
      </div>

      {vista === 'resumen' ? (
        <AuditoriaResumen
          onVerPendientes={() => {
            setSoloPendientes(true);
            setVista('registro');
          }}
        />
      ) : (
        <AuditoriaRegistro key={String(soloPendientes)} soloPendientes={soloPendientes} />
      )}
    </div>
  );
}
