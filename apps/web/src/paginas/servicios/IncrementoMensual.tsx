import { esquemaActualizarConfiguracionPrecios } from '@confluens/shared';
import { TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VentanaFormulario } from '@/components/VentanaFormulario';
import {
  useConfiguracionPrecios,
  useGuardarConfiguracionPrecios,
} from '@/hooks/use-configuracion-precios';
import { ErrorApiCliente } from '@/lib/api';

// RN-10 / RN-13: el porcentaje de incremento mensual. Con él se proyectan a la fecha del evento
// los precios del salón y de los servicios propios en el cotizador y en los presupuestos; los
// tercerizados no. Lo demás de RN-10 (aplicar el aumento al tarifario y los aumentos puntuales)
// es HU-34.
export function IncrementoMensual() {
  const configuracion = useConfiguracionPrecios();
  const [abierto, setAbierto] = useState(false);
  if (configuracion.isLoading) return null;
  if (configuracion.isError || !configuracion.data) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        No se pudo cargar el incremento mensual.
      </p>
    );
  }
  const porcentajeActual = configuracion.data.porcentajeMensual;
  return (
    <>
      <Button variant="outline" onClick={() => setAbierto(true)}>
        <TrendingUp /> Incremento mensual: {Number(porcentajeActual)}%
      </Button>
      <VentanaFormulario
        abierto={abierto}
        onCambiarAbierto={setAbierto}
        titulo="Incremento mensual de precios"
        descripcion="Los precios del salón y de los servicios propios se proyectan a la fecha del evento, sumando este porcentaje por cada mes. Los tercerizados no se proyectan y los presupuestos ya emitidos no cambian."
      >
        {/* La key reinicia el campo con el valor guardado cada vez que se abre la ventana. */}
        <Formulario
          key={String(abierto)}
          porcentajeActual={porcentajeActual}
          onGuardado={() => setAbierto(false)}
        />
      </VentanaFormulario>
    </>
  );
}

function Formulario({
  porcentajeActual,
  onGuardado,
}: {
  porcentajeActual: string;
  onGuardado: () => void;
}) {
  const guardar = useGuardarConfiguracionPrecios();
  const [porcentaje, setPorcentaje] = useState(String(Number(porcentajeActual)));
  const [error, setError] = useState<string | null>(null);

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    // Se acepta la coma decimal, como se escribe acá.
    const resultado = esquemaActualizarConfiguracionPrecios.safeParse({
      porcentajeMensual: porcentaje.trim().replace(',', '.'),
    });
    if (!resultado.success) {
      setError(resultado.error.issues[0]?.message ?? 'Porcentaje inválido');
      return;
    }
    setError(null);
    guardar.mutate(resultado.data, { onSuccess: onGuardado });
  }

  const sinCambios = Number(porcentaje.replace(',', '.')) === Number(porcentajeActual);

  return (
    <form onSubmit={manejarEnvio} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="incremento-mensual">Porcentaje por mes</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="incremento-mensual"
              inputMode="decimal"
              className="w-24"
              value={porcentaje}
              aria-invalid={!!error}
              onChange={(e) => setPorcentaje(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <Button type="submit" size="sm" disabled={guardar.isPending || sinCambios}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {guardar.isError && (
        <p className="text-sm text-destructive">
          {guardar.error instanceof ErrorApiCliente
            ? guardar.error.message
            : 'No se pudo guardar el porcentaje.'}
        </p>
      )}
    </form>
  );
}
