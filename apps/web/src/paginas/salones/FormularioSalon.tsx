import { esquemaModificarSalon, type SalonConDistribuciones } from '@confluens/shared';
import { useState } from 'react';

import { InputImporte } from '@/components/InputImporte';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useModificarSalon } from '@/hooks/use-salones';
import { ErrorApiCliente } from '@/lib/api';

// HU-26: modificar los precios de un salón. El nombre, la capacidad máxima y la superficie son
// fijos (equipo, 03/11/2026); las distribuciones se editan desde su propia fila y la landing sigue
// en HU-08. Mismo patrón que los demás formularios del catálogo: estado controlado y validación con
// el schema de shared antes de enviar.
export function FormularioSalon({
  salon,
  onGuardado,
}: {
  salon: SalonConDistribuciones;
  onGuardado: () => void;
}) {
  const modificarSalon = useModificarSalon();
  const [valores, setValores] = useState({
    precioJornadaCompleta: salon.precioJornadaCompleta,
    precioMediaJornada: salon.precioMediaJornada,
  });
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});

  function actualizarCampo(campo: keyof typeof valores, valor: string) {
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
  }

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    const resultado = esquemaModificarSalon.safeParse({
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
            : 'No se pudieron modificar los precios.'}
        </p>
      )}
      <Button type="submit" disabled={modificarSalon.isPending}>
        {modificarSalon.isPending ? 'Guardando…' : 'Guardar precios'}
      </Button>
    </form>
  );
}
