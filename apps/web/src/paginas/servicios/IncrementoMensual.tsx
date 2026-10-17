import { esquemaActualizarConfiguracionPrecios } from '@confluens/shared';
import { TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  if (configuracion.isLoading) return null;
  if (configuracion.isError || !configuracion.data) {
    return (
      <p className="mx-6 mt-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        No se pudo cargar el incremento mensual.
      </p>
    );
  }
  // Mismo ancho y margen que el formulario de servicios que va debajo.
  return (
    <div className="mx-auto max-w-2xl px-6 pt-6">
      <Formulario porcentajeActual={configuracion.data.porcentajeMensual} />
    </div>
  );
}

function Formulario({ porcentajeActual }: { porcentajeActual: string }) {
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
    guardar.mutate(resultado.data);
  }

  const sinCambios = Number(porcentaje.replace(',', '.')) === Number(porcentajeActual);

  return (
    <form onSubmit={manejarEnvio} className="space-y-3 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <TrendingUp className="size-4 text-bordo" /> Incremento mensual de precios
      </h2>
      <p className="text-xs text-muted-foreground">
        Los precios del salón y de los servicios propios se proyectan a la fecha del evento, sumando
        este porcentaje por cada mes. Los tercerizados no se proyectan y los presupuestos ya
        emitidos no cambian.
      </p>
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
        {guardar.isSuccess && sinCambios && (
          <span className="text-xs text-emerald-700">Guardado</span>
        )}
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
