import {
  type Distribucion,
  esquemaCrearDistribucion,
  esquemaModificarDistribucion,
  type SalonConDistribuciones,
} from '@confluens/shared';
import { ArchiveRestore, Ban, CheckCircle2, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VentanaFormulario } from '@/components/VentanaFormulario';
import {
  useCambiarEstadoDistribucion,
  useCrearDistribucion,
  useModificarDistribucion,
  useSalones,
} from '@/hooks/use-salones';
import { ErrorApiCliente } from '@/lib/api';
import { formatearPesos } from '@/lib/formato';
import { cn } from '@/lib/utils';

import { FormularioSalon } from './FormularioSalon';

// Mismo formato que los importes de negocio/tarifario-2026.md (separador de miles es-AR).
const formatoNumero = new Intl.NumberFormat('es-AR');

// HU-25 (alta) y HU-26 (edición, con `distribucion`) de una distribución del salón. Mismo patrón
// que RegistrarMedioPago: estado controlado y validación con el schema de shared antes de enviar.
// Que el nombre no se repita en el salón y que la capacidad no supere la del salón lo controla la
// API (409 y 422), y su mensaje se muestra tal cual.
function FormularioDistribucion({
  salon,
  distribucion,
  onGuardada,
}: {
  salon: SalonConDistribuciones;
  distribucion?: Distribucion;
  onGuardada: (nombre: string) => void;
}) {
  const crearDistribucion = useCrearDistribucion();
  const modificarDistribucion = useModificarDistribucion();
  const mutacion = distribucion ? modificarDistribucion : crearDistribucion;
  const [valores, setValores] = useState({
    nombre: distribucion?.nombre ?? '',
    capacidad: distribucion ? String(distribucion.capacidad) : '',
  });
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    // El input numérico entrega texto; vacío queda sin capacidad para que el schema pida escribirla.
    const esquema = distribucion ? esquemaModificarDistribucion : esquemaCrearDistribucion;
    const resultado = esquema.safeParse({
      nombre: valores.nombre,
      capacidad: valores.capacidad === '' ? undefined : Number(valores.capacidad),
    });
    if (!resultado.success) {
      const errores: Record<string, string> = {};
      for (const issue of resultado.error.issues) errores[String(issue.path[0])] = issue.message;
      setErroresCampos(errores);
      return;
    }
    setErroresCampos({});
    const alGuardar = { onSuccess: (guardada: Distribucion) => onGuardada(guardada.nombre) };
    if (distribucion) {
      modificarDistribucion.mutate(
        { salonId: salon.id, distribucionId: distribucion.id, datos: resultado.data },
        alGuardar,
      );
    } else {
      crearDistribucion.mutate({ salonId: salon.id, datos: resultado.data }, alGuardar);
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="distribucion-nombre">Nombre</Label>
        <Input
          id="distribucion-nombre"
          placeholder="Ej.: Banquete"
          maxLength={40}
          value={valores.nombre}
          aria-invalid={!!erroresCampos['nombre']}
          onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
        />
        {erroresCampos['nombre'] && (
          <p className="text-sm text-destructive">{erroresCampos['nombre']}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="distribucion-capacidad">Capacidad (personas)</Label>
        <Input
          id="distribucion-capacidad"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={valores.capacidad}
          aria-invalid={!!erroresCampos['capacidad']}
          onChange={(e) => setValores((v) => ({ ...v, capacidad: e.target.value }))}
        />
        {erroresCampos['capacidad'] ? (
          <p className="text-sm text-destructive">{erroresCampos['capacidad']}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Hasta {formatoNumero.format(salon.capacidadMaxima)} personas, la capacidad máxima del
            salón.
          </p>
        )}
      </div>

      {mutacion.isError && (
        <p className="text-sm text-destructive">
          {mutacion.error instanceof ErrorApiCliente
            ? mutacion.error.message
            : 'No se pudo guardar la distribución.'}
        </p>
      )}
      <Button type="submit" disabled={mutacion.isPending}>
        {mutacion.isPending
          ? 'Guardando…'
          : distribucion
            ? 'Guardar cambios'
            : 'Registrar distribución'}
      </Button>
    </form>
  );
}

// Ficha de consulta de los salones (HU-03, criterios 1 y 3): los cinco salones con su capacidad,
// superficie y distribuciones. Desde el salón abierto se modifican sus precios y sus distribuciones
// (HU-26) y se registran distribuciones nuevas (HU-25). La capacidad máxima y la superficie son
// fijas (equipo, 03/11/2026); dar de baja una distribución espera la definición del PO
// (sprint-04.md).
//
// El filtro por capacidad mínima (criterio 2) y el aviso de "ninguno cubre esa capacidad, el mayor
// es X" (criterio 4) se sacaron de acá: el cotizador ya resuelve las dos cosas contra la cantidad
// de personas real del evento, que es el momento en que la pregunta se hace (CotizarEvento.tsx).
export function ConsultarSalones() {
  const { data: salones, isLoading, isError } = useSalones();
  const [salonSeleccionadoId, setSalonSeleccionadoId] = useState<number | null>(null);
  const [salonDelAlta, setSalonDelAlta] = useState<SalonConDistribuciones | null>(null);
  const [distribucionEnEdicion, setDistribucionEnEdicion] = useState<{
    salon: SalonConDistribuciones;
    distribucion: Distribucion;
  } | null>(null);
  const [guardada, setGuardada] = useState<{
    salonId: number;
    nombre: string;
    nueva: boolean;
  } | null>(null);
  const [salonEnEdicion, setSalonEnEdicion] = useState<SalonConDistribuciones | null>(null);
  const [modificadoId, setModificadoId] = useState<number | null>(null);
  const cambiarEstado = useCambiarEstadoDistribucion();
  const [estadoCambiado, setEstadoCambiado] = useState<{
    salonId: number;
    nombre: string;
    activo: boolean;
  } | null>(null);

  // HU-25 del Sprint 4: baja lógica o reactivación. Es reversible, así que no pide confirmación.
  function alternarEstado(salon: SalonConDistribuciones, distribucion: Distribucion) {
    setGuardada(null);
    setEstadoCambiado(null);
    cambiarEstado.mutate(
      { salonId: salon.id, distribucionId: distribucion.id, activo: !distribucion.activo },
      {
        onSuccess: (cambiada) =>
          setEstadoCambiado({
            salonId: salon.id,
            nombre: cambiada.nombre,
            activo: cambiada.activo,
          }),
      },
    );
  }

  if (isLoading) {
    return <p className="p-6 text-muted-foreground">Cargando salones…</p>;
  }

  if (isError) {
    return <p className="p-6 text-destructive">No se pudo cargar el catálogo de salones.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Salones</h1>
        <p className="text-sm text-muted-foreground">
          Capacidad, superficie y distribuciones posibles de cada salón.
        </p>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {(salones ?? []).map((salon) => (
          <li key={salon.id}>
            <button
              type="button"
              onClick={() =>
                setSalonSeleccionadoId(salon.id === salonSeleccionadoId ? null : salon.id)
              }
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted"
              aria-expanded={salon.id === salonSeleccionadoId}
            >
              <span className="font-medium">{salon.nombre}</span>
              <span className="text-sm text-muted-foreground">
                {formatoNumero.format(salon.capacidadMaxima)} personas ·{' '}
                {formatoNumero.format(salon.superficie)} m²
              </span>
            </button>

            {salon.id === salonSeleccionadoId && (
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                    <dt className="text-muted-foreground">Jornada completa</dt>
                    <dd className="text-right tabular-nums">
                      {formatearPesos(salon.precioJornadaCompleta)}
                    </dd>
                    <dt className="text-muted-foreground">Media jornada</dt>
                    <dd className="text-right tabular-nums">
                      {formatearPesos(salon.precioMediaJornada)}
                    </dd>
                  </dl>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setModificadoId(null);
                      setSalonEnEdicion(salon);
                    }}
                  >
                    <Pencil /> Modificar precios
                  </Button>
                </div>
                {modificadoId === salon.id && (
                  <p className="mb-3 flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="size-4" /> Los precios del salón quedaron actualizados.
                  </p>
                )}
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Distribuciones</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setGuardada(null);
                      setSalonDelAlta(salon);
                    }}
                  >
                    <Plus /> Nueva distribución
                  </Button>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {salon.distribuciones.map((distribucion) => (
                    <li
                      key={distribucion.id}
                      className={cn(
                        'flex items-center justify-between gap-3',
                        !distribucion.activo && 'opacity-60',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {distribucion.nombre}
                        {!distribucion.activo && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                            Dada de baja
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {formatoNumero.format(distribucion.capacidad)} personas
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Modificar ${distribucion.nombre}`}
                          onClick={() => {
                            setGuardada(null);
                            setDistribucionEnEdicion({ salon, distribucion });
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={cambiarEstado.isPending}
                          aria-label={
                            distribucion.activo
                              ? `Dar de baja ${distribucion.nombre}`
                              : `Reactivar ${distribucion.nombre}`
                          }
                          title={distribucion.activo ? 'Dar de baja' : 'Reactivar'}
                          onClick={() => alternarEstado(salon, distribucion)}
                        >
                          {distribucion.activo ? <Ban /> : <ArchiveRestore />}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
                {estadoCambiado?.salonId === salon.id && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="size-4" />
                    {estadoCambiado.activo
                      ? `«${estadoCambiado.nombre}» se reactivó y se puede volver a elegir.`
                      : `«${estadoCambiado.nombre}» quedó dada de baja: ya no se ofrece al presupuestar ni al agendar. Los eventos que la tienen no cambian.`}
                  </p>
                )}
                {cambiarEstado.isError && cambiarEstado.variables?.salonId === salon.id && (
                  <p className="mt-3 text-sm text-destructive">
                    {cambiarEstado.error instanceof ErrorApiCliente
                      ? cambiarEstado.error.message
                      : 'No se pudo cambiar el estado de la distribución.'}
                  </p>
                )}
                {guardada?.salonId === salon.id && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="size-4" />
                    {guardada.nueva
                      ? `«${guardada.nombre}» quedó registrada y ya se puede elegir al presupuestar y al agendar.`
                      : `«${guardada.nombre}» quedó actualizada.`}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <VentanaFormulario
        abierto={salonDelAlta !== null}
        onCambiarAbierto={(abierto) => !abierto && setSalonDelAlta(null)}
        titulo={`Nueva distribución en ${salonDelAlta?.nombre ?? ''}`}
        descripcion="El nombre no puede repetirse en el salón y la capacidad no puede superar la del salón."
      >
        {/* Se desmonta al cerrar la ventana, así cada apertura arranca con el formulario vacío. */}
        {salonDelAlta && (
          <FormularioDistribucion
            key={salonDelAlta.id}
            salon={salonDelAlta}
            onGuardada={(nombre) => {
              setGuardada({ salonId: salonDelAlta.id, nombre, nueva: true });
              setSalonDelAlta(null);
            }}
          />
        )}
      </VentanaFormulario>

      <VentanaFormulario
        abierto={distribucionEnEdicion !== null}
        onCambiarAbierto={(abierto) => !abierto && setDistribucionEnEdicion(null)}
        titulo={`Modificar ${distribucionEnEdicion?.distribucion.nombre ?? ''}`}
        descripcion="El cambio se ve también en los eventos que ya usan esta distribución."
      >
        {/* Se desmonta al cerrar: cada apertura arranca con los datos guardados. */}
        {distribucionEnEdicion && (
          <FormularioDistribucion
            key={distribucionEnEdicion.distribucion.id}
            salon={distribucionEnEdicion.salon}
            distribucion={distribucionEnEdicion.distribucion}
            onGuardada={(nombre) => {
              setGuardada({ salonId: distribucionEnEdicion.salon.id, nombre, nueva: false });
              setDistribucionEnEdicion(null);
            }}
          />
        )}
      </VentanaFormulario>

      <VentanaFormulario
        abierto={salonEnEdicion !== null}
        onCambiarAbierto={(abierto) => !abierto && setSalonEnEdicion(null)}
        titulo={`Precios de ${salonEnEdicion?.nombre ?? ''}`}
        descripcion="Precios sin IVA. El nombre, la capacidad máxima y la superficie del salón no se modifican."
      >
        {/* Se desmonta al cerrar: cada apertura arranca con los datos guardados del salón. */}
        {salonEnEdicion && (
          <FormularioSalon
            key={salonEnEdicion.id}
            salon={salonEnEdicion}
            onGuardado={() => {
              setModificadoId(salonEnEdicion.id);
              setSalonEnEdicion(null);
            }}
          />
        )}
      </VentanaFormulario>
    </div>
  );
}
