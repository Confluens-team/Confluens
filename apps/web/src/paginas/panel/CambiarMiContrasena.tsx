import { esquemaCambiarMiContrasena } from '@confluens/shared';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VentanaFormulario } from '@/components/VentanaFormulario';
import { useCambiarMiContrasena } from '@/hooks/use-sesion';
import { ErrorApiCliente } from '@/lib/api';

const vacio = { actual: '', nueva: '', repetida: '' };

// La contraseña actual y la nueva dos veces, para no dejarla mal tipeada.
function FormularioMiContrasena({ onGuardada }: { onGuardada: () => void }) {
  const cambiar = useCambiarMiContrasena();
  const [valores, setValores] = useState(vacio);
  const [errores, setErrores] = useState<Record<string, string>>({});

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    cambiar.reset();
    const resultado = esquemaCambiarMiContrasena.safeParse(valores);
    const nuevos: Record<string, string> = {};
    if (!resultado.success) {
      for (const issue of resultado.error.issues) nuevos[String(issue.path[0])] = issue.message;
    }
    if (!nuevos['nueva'] && valores.nueva !== valores.repetida) {
      nuevos['repetida'] = 'Las dos contraseñas nuevas no coinciden';
    }
    setErrores(nuevos);
    if (!resultado.success || Object.keys(nuevos).length > 0) return;
    cambiar.mutate(resultado.data, { onSuccess: onGuardada });
  }

  const campo = (id: keyof typeof vacio, etiqueta: string, autocompletar: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`mi-contrasena-${id}`}>{etiqueta}</Label>
      <Input
        id={`mi-contrasena-${id}`}
        type="password"
        autoComplete={autocompletar}
        value={valores[id]}
        aria-invalid={!!errores[id]}
        onChange={(e) => setValores((anteriores) => ({ ...anteriores, [id]: e.target.value }))}
      />
      {errores[id] && <p className="text-sm text-destructive">{errores[id]}</p>}
    </div>
  );

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      {campo('actual', 'Contraseña actual', 'current-password')}
      {campo('nueva', 'Contraseña nueva', 'new-password')}
      {campo('repetida', 'Repetí la contraseña nueva', 'new-password')}
      {cambiar.isError && (
        <p className="text-sm text-destructive">
          {cambiar.error instanceof ErrorApiCliente
            ? cambiar.error.message
            : 'No se pudo cambiar la contraseña.'}
        </p>
      )}
      <Button type="submit" disabled={cambiar.isPending}>
        {cambiar.isPending ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}

// HU-30 del backlog: cada usuario cambia su contraseña desde Mi cuenta, con la actual (PO,
// 06/11/2026). Es opcional, así que queda como un botón chico que abre el formulario en una ventana
// (PO, 07/11/2026). Al cambiarla se cierran las demás sesiones abiertas; esta sigue.
export function BotonCambiarMiContrasena() {
  const [abierto, setAbierto] = useState(false);
  const [cambiada, setCambiada] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setCambiada(false);
          setAbierto(true);
        }}
      >
        <KeyRound /> Cambiar contraseña
      </Button>
      {cambiada && (
        <p className="flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" /> Tu contraseña quedó cambiada.
        </p>
      )}
      <VentanaFormulario
        abierto={abierto}
        onCambiarAbierto={setAbierto}
        titulo="Cambiar contraseña"
        descripcion="Al menos 6 caracteres. Se cierran tus sesiones abiertas en otros dispositivos."
      >
        {/* La key vacía el formulario cada vez que se abre la ventana. */}
        <FormularioMiContrasena
          key={String(abierto)}
          onGuardada={() => {
            setCambiada(true);
            setAbierto(false);
          }}
        />
      </VentanaFormulario>
    </>
  );
}
