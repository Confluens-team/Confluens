import { esquemaModificarSalon, type SalonConDistribuciones } from '@confluens/shared';
import { useState } from 'react';

import { InputImporte } from '@/components/InputImporte';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useModificarSalon } from '@/hooks/use-salones';
import { ErrorApiCliente } from '@/lib/api';

const formatoNumero = new Intl.NumberFormat('es-AR');

// Los enteros llegan del input como texto; vacío queda sin valor para que el schema pida escribirlo.
const entero = (texto: string) => (texto.trim() === '' ? undefined : Number(texto));

// HU-26: modificar la capacidad máxima, la superficie y los precios de un salón. El nombre no se
// edita y la landing sigue en HU-08. Mismo patrón que los demás formularios del catálogo: estado
// controlado y validación con el schema de shared antes de enviar.
//
// Si la capacidad nueva queda por debajo de la de alguna distribución, la API la baja a la del salón
// (equipo, 03/11/2026); el formulario lo avisa antes de guardar para que no sea una sorpresa.
export function FormularioSalon({
  salon,
  onGuardado,
}: {
  salon: SalonConDistribuciones;
  onGuardado: () => void;
}) {
  const modificarSalon = useModificarSalon();
  const [valores, setValores] = useState({
    capacidadMaxima: String(salon.capacidadMaxima),
    superficie: String(salon.superficie),
    precioJornadaCompleta: salon.precioJornadaCompleta,
    precioMediaJornada: salon.precioMediaJornada,
  });
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});

  const capacidadNueva = entero(valores.capacidadMaxima);
  const queBajan =
    capacidadNueva && capacidadNueva > 0
      ? salon.distribuciones.filter((d) => d.capacidad > capacidadNueva)
      : [];

  function actualizarCampo(campo: keyof typeof valores, valor: string) {
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
  }

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    const resultado = esquemaModificarSalon.safeParse({
      capacidadMaxima: capacidadNueva,
      superficie: entero(valores.superficie),
      precioJornadaCompleta: valores.precioJornadaCompleta.trim(),
      precioMediaJornada: valores.precioMediaJornada.trim(),
    });
    if (!resultado.success) {
      const errores: Record<string, string> = {};
      for (const issue of resultado.error.issues) errores[String(issue.path[0])] = issue.message;
      setErroresCampos(errores);
      return;
    }
    setErroresCampos({});
    modificarSalon.mutate({ id: salon.id, datos: resultado.data }, { onSuccess: onGuardado });
  }

  function error(campo: string) {
    return (
      erroresCampos[campo] && <p className="text-sm text-destructive">{erroresCampos[campo]}</p>
    );
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="salon-capacidad">Capacidad máxima</Label>
          <Input
            id="salon-capacidad"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={valores.capacidadMaxima}
            aria-invalid={!!erroresCampos['capacidadMaxima']}
            onChange={(e) => actualizarCampo('capacidadMaxima', e.target.value)}
          />
          {error('capacidadMaxima')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salon-superficie">Superficie (m²)</Label>
          <Input
            id="salon-superficie"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={valores.superficie}
            aria-invalid={!!erroresCampos['superficie']}
            onChange={(e) => actualizarCampo('superficie', e.target.value)}
          />
          {error('superficie')}
        </div>
      </div>

      {queBajan.length > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          {queBajan.map((d) => `${d.nombre} (${formatoNumero.format(d.capacidad)})`).join(', ')}{' '}
          {queBajan.length === 1 ? 'va a bajar' : 'van a bajar'} a{' '}
          {formatoNumero.format(capacidadNueva!)} personas, la capacidad nueva del salón.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="salon-precio-completa">Jornada completa (sin IVA)</Label>
          <InputImporte
            id="salon-precio-completa"
            value={valores.precioJornadaCompleta}
            aria-invalid={!!erroresCampos['precioJornadaCompleta']}
            onChange={(e) => actualizarCampo('precioJornadaCompleta', e.target.value)}
          />
          {error('precioJornadaCompleta')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salon-precio-media">Media jornada (sin IVA)</Label>
          <InputImporte
            id="salon-precio-media"
            value={valores.precioMediaJornada}
            aria-invalid={!!erroresCampos['precioMediaJornada']}
            onChange={(e) => actualizarCampo('precioMediaJornada', e.target.value)}
          />
          {error('precioMediaJornada')}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Un cambio de precio no afecta los presupuestos ya emitidos: conservan el precio con que se
        armaron. Los nuevos lo toman proyectado a la fecha del evento (RN-13).
      </p>

      {modificarSalon.isError && (
        <p className="text-sm text-destructive">
          {modificarSalon.error instanceof ErrorApiCliente
            ? modificarSalon.error.message
            : 'No se pudo modificar el salón.'}
        </p>
      )}
      <Button type="submit" disabled={modificarSalon.isPending}>
        {modificarSalon.isPending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  );
}
