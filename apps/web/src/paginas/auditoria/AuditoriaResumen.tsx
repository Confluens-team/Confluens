import type { EntidadAuditada, RegistroAuditoria } from '@confluens/shared';

import { useResumenAuditoria } from '@/hooks/use-auditoria';
import {
  etiquetaDeRegistro,
  formatearFechaHora,
  formatearValor,
  NOMBRES_DE_ENTIDAD,
  nombreDeCampo,
  resumenDelCambio,
} from '@/lib/auditoria';
import { NOMBRES_DE_ROL } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { BotonRevisado, Inicial } from './piezas';

// «+18% que la semana anterior», «igual que…», o nada si antes no hubo cambios con qué comparar.
function comparacion(actual: number, anterior: number, dias: number): string {
  const periodo = dias === 7 ? 'la semana anterior' : `los ${dias} días anteriores`;
  if (anterior === 0)
    return actual === 0 ? `Sin cambios, como ${periodo}` : `Sin cambios ${periodo}`;
  const variacion = Math.round(((actual - anterior) / anterior) * 100);
  if (variacion === 0) return `Igual que ${periodo}`;
  return `${variacion > 0 ? '+' : ''}${variacion}% que ${periodo}`;
}

function Indicador({
  titulo,
  valor,
  detalle,
  destacado = false,
}: {
  titulo: string;
  valor: number;
  detalle: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-xl p-4 ring-1',
        destacado ? 'bg-dorado/15 ring-dorado/40' : 'bg-card ring-border',
      )}
    >
      <span
        className={cn(
          'text-sm',
          destacado ? 'font-semibold text-dorado-texto' : 'font-medium text-muted-foreground',
        )}
      >
        {titulo}
      </span>
      <span
        className={cn(
          'font-serif text-3xl font-semibold tabular-nums',
          destacado ? 'text-dorado-texto' : 'text-bordo',
        )}
      >
        {valor}
      </span>
      <span className={cn('text-xs', destacado ? 'text-dorado-texto' : 'text-muted-foreground')}>
        {detalle}
      </span>
    </div>
  );
}

// Una línea de «Para revisar»: quién, qué, el antes → después de lo que cambió y cuándo.
function CambioParaRevisar({ registro }: { registro: RegistroAuditoria }) {
  const cambios = registro.campos
    .slice(0, 2)
    .map((campo) =>
      registro.tipo === 'alta'
        ? `${nombreDeCampo(campo)}: ${formatearValor(campo, registro.valorNuevo?.[campo])}`
        : `${nombreDeCampo(campo)}: ${formatearValor(campo, registro.valorAnterior?.[campo])} → ${formatearValor(campo, registro.valorNuevo?.[campo])}`,
    )
    .join(' · ');
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <Inicial usuario={registro.usuario} className="size-9" />
      <div className="min-w-0 flex-[1_1_16rem] space-y-1">
        <p className="text-sm">
          <span className="font-semibold">{registro.usuario?.email ?? 'Sistema'}</span>{' '}
          {resumenDelCambio(registro).toLowerCase()} ·{' '}
          <span className="font-medium text-bordo">{etiquetaDeRegistro(registro)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {cambios} · {formatearFechaHora(registro.fecha)}
        </p>
      </div>
      <BotonRevisado registro={registro} />
    </li>
  );
}

/**
 * Diseño B: el resumen de la auditoría para el Gerente General. Qué pasó en la última semana, lo
 * sensible que espera su revisión, quién hizo cambios y en qué parte del sistema.
 */
export function AuditoriaResumen({ onVerPendientes }: { onVerPendientes: () => void }) {
  const { data: resumen, isLoading, isError } = useResumenAuditoria(7);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (isError || !resumen) {
    return <p className="text-sm text-destructive">No se pudo cargar el resumen.</p>;
  }

  const masCambios = Math.max(1, ...resumen.porPersona.map((persona) => persona.cambios));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Esto pasó en el panel en los últimos {resumen.dias} días.
      </p>

      <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Cambios registrados"
          valor={resumen.cambios}
          detalle={comparacion(resumen.cambios, resumen.cambiosPeriodoAnterior, resumen.dias)}
        />
        <Indicador
          titulo="Cambios sensibles sin revisar"
          valor={resumen.sensiblesPendientes}
          detalle="Precios, cobros y permisos"
          destacado={resumen.sensiblesPendientes > 0}
        />
        <Indicador
          titulo="Bajas y anulaciones"
          valor={resumen.bajas}
          detalle={
            resumen.bajasDePagos === 1 ? '1 sobre un pago' : `${resumen.bajasDePagos} sobre pagos`
          }
        />
        <Indicador
          titulo="Personas que hicieron cambios"
          valor={resumen.personas}
          detalle={
            resumen.automaticos === 1
              ? 'más 1 cambio automático'
              : `más ${resumen.automaticos} cambios automáticos`
          }
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="para-revisar" className="rounded-xl bg-card ring-1 ring-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h3 id="para-revisar" className="font-semibold">
                Para revisar
              </h3>
              <p className="text-xs text-muted-foreground">
                Cambios sensibles de otros usuarios. Se van cuando los marcás como revisados; los de
                la gerencia y los automáticos no se revisan.
              </p>
            </div>
            <button
              type="button"
              onClick={onVerPendientes}
              className="text-sm font-medium text-bordo underline-offset-2 hover:underline"
            >
              Ver todos en Registro
            </button>
          </div>
          {resumen.paraRevisar.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No hay cambios sensibles esperando revisión.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {resumen.paraRevisar.map((registro) => (
                <CambioParaRevisar key={registro.id} registro={registro} />
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <section
            aria-labelledby="quien-cambio"
            className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-border"
          >
            <h3 id="quien-cambio" className="font-semibold">
              Quién hizo cambios
            </h3>
            {resumen.porPersona.length === 0 && (
              <p className="text-sm text-muted-foreground">Nadie hizo cambios en el período.</p>
            )}
            {resumen.porPersona.map(({ usuario, cambios }) => (
              <div key={usuario?.id ?? 'sistema'} className="space-y-1.5">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{usuario?.email ?? 'Sistema (automático)'}</span>
                    {usuario && (
                      <span className="text-xs text-muted-foreground">
                        {' '}
                        · {NOMBRES_DE_ROL[usuario.rol]}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{cambios}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn('h-2 rounded-full', usuario ? 'bg-bordo' : 'bg-estado-cancelado')}
                    style={{ width: `${Math.round((cambios / masCambios) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </section>

          <section
            aria-labelledby="donde-cambio"
            className="rounded-xl bg-card p-5 ring-1 ring-border"
          >
            <h3 id="donde-cambio" className="mb-2 font-semibold">
              Dónde se cambió
            </h3>
            {resumen.porEntidad.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin cambios en el período.</p>
            )}
            <ul className="divide-y divide-border text-sm">
              {resumen.porEntidad.map(({ entidad, cambios }) => (
                <li key={entidad} className="flex justify-between gap-2 py-2">
                  <span>{NOMBRES_DE_ENTIDAD[entidad as EntidadAuditada] ?? entidad}</span>
                  <span className="font-semibold tabular-nums">{cambios}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
