import { esquemaCrearDistribucion, type SalonConDistribuciones } from '@confluens/shared';
import { CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VentanaFormulario } from '@/components/VentanaFormulario';
import { useCrearDistribucion, useSalones } from '@/hooks/use-salones';
import { ErrorApiCliente } from '@/lib/api';

// Mismo formato que los importes de negocio/tarifario-2026.md (separador de miles es-AR).
const formatoNumero = new Intl.NumberFormat('es-AR');

const valoresIniciales = { nombre: '', capacidad: '' };

// HU-25: alta de una distribución del salón. Mismo patrón que RegistrarMedioPago: estado
// controlado y validación con el schema de shared antes de enviar. Que el nombre no se repita en
// el salón y que la capacidad no supere la del salón lo controla la API (409 y 422), y su mensaje
// se muestra tal cual.
function FormularioDistribucion({
  salon,
  onRegistrada,
}: {
  salon: SalonConDistribuciones;
  onRegistrada: (nombre: string) => void;
}) {
  const crearDistribucion = useCrearDistribucion();
  const [valores, setValores] = useState(valoresIniciales);
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    // El input numérico entrega texto; vacío queda sin capacidad para que el schema pida escribirla.
    const resultado = esquemaCrearDistribucion.safeParse({
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
    crearDistribucion.mutate(
      { salonId: salon.id, datos: resultado.data },
      { onSuccess: (distribucion) => onRegistrada(distribucion.nombre) },
    );
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

      {crearDistribucion.isError && (
        <p className="text-sm text-destructive">
          {crearDistribucion.error instanceof ErrorApiCliente
            ? crearDistribucion.error.message
            : 'No se pudo registrar la distribución.'}
        </p>
      )}
      <Button type="submit" disabled={crearDistribucion.isPending}>
        {crearDistribucion.isPending ? 'Registrando…' : 'Registrar distribución'}
      </Button>
    </form>
  );
}

// Ficha de consulta de los salones (HU-03, criterios 1 y 3): los cinco salones con su capacidad,
// superficie y distribuciones. Desde HU-25 se registran distribuciones nuevas desde el salón
// abierto; modificarlas y darlas de baja espera la definición del PO (sprint-04.md).
//
// El filtro por capacidad mínima (criterio 2) y el aviso de "ninguno cubre esa capacidad, el mayor
// es X" (criterio 4) se sacaron de acá: el cotizador ya resuelve las dos cosas contra la cantidad
// de personas real del evento, que es el momento en que la pregunta se hace (CotizarEvento.tsx).
export function ConsultarSalones() {
  const { data: salones, isLoading, isError } = useSalones();
  const [salonSeleccionadoId, setSalonSeleccionadoId] = useState<number | null>(null);
  const [salonDelAlta, setSalonDelAlta] = useState<SalonConDistribuciones | null>(null);
  const [registrada, setRegistrada] = useState<{ salonId: number; nombre: string } | null>(null);

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
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Distribuciones</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRegistrada(null);
                      setSalonDelAlta(salon);
                    }}
                  >
                    <Plus /> Nueva distribución
                  </Button>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {salon.distribuciones.map((distribucion) => (
                    <li key={distribucion.id} className="flex justify-between">
                      <span>{distribucion.nombre}</span>
                      <span>{formatoNumero.format(distribucion.capacidad)} personas</span>
                    </li>
                  ))}
                </ul>
                {registrada?.salonId === salon.id && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="size-4" /> «{registrada.nombre}» quedó registrada y ya
                    se puede elegir al presupuestar y al agendar.
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
            onRegistrada={(nombre) => {
              setRegistrada({ salonId: salonDelAlta.id, nombre });
              setSalonDelAlta(null);
            }}
          />
        )}
      </VentanaFormulario>
    </div>
  );
}
