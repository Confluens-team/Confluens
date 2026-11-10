import {
  esquemaCrearMedioPago,
  esquemaModificarMedioPago,
  type MedioPago,
} from '@confluens/shared';
import { CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VentanaFormulario } from '@/components/VentanaFormulario';
import { useCrearMedioPago, useModificarMedioPago } from '@/hooks/use-pagos';
import { ErrorApiCliente } from '@/lib/api';

import { ListadoMediosPago } from './ListadoMediosPago';

const valoresIniciales = { nombre: '' };

// HU-19: alta de un medio de pago. Desde HU-53 se carga solo el nombre: todos los medios se pueden
// usar en todos los cobros (RN-14). Mismo patrón que RegistrarServicio: estado controlado y
// validación con el schema de shared antes de enviar, para mostrar el mismo error que devolvería la
// API sin esperar el round-trip.
//
// Con `medio` el mismo formulario lo modifica (HU-33): arranca con su nombre.
function FormularioMedioPago({
  medio,
  onGuardado,
}: {
  medio?: MedioPago;
  onGuardado: (nombre: string) => void;
}) {
  const crearMedioPago = useCrearMedioPago();
  const modificarMedioPago = useModificarMedioPago();
  const guardar = medio ? modificarMedioPago : crearMedioPago;
  const [valores, setValores] = useState(medio ? { nombre: medio.nombre } : valoresIniciales);
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});

  function actualizarCampo<K extends keyof typeof valoresIniciales>(
    campo: K,
    valor: (typeof valoresIniciales)[K],
  ) {
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
  }

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    const resultado = (medio ? esquemaModificarMedioPago : esquemaCrearMedioPago).safeParse(
      valores,
    );
    if (!resultado.success) {
      const errores: Record<string, string> = {};
      for (const issue of resultado.error.issues) errores[String(issue.path[0])] = issue.message;
      setErroresCampos(errores);
      return;
    }
    setErroresCampos({});
    const alTerminar = { onSuccess: (guardado: MedioPago) => onGuardado(guardado.nombre) };
    if (medio) {
      modificarMedioPago.mutate({ id: medio.id, datos: resultado.data }, alTerminar);
    } else {
      crearMedioPago.mutate(resultado.data, alTerminar);
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="medio-nombre">Nombre</Label>
        <Input
          id="medio-nombre"
          placeholder="Ej.: Mercado Pago"
          maxLength={40}
          value={valores.nombre}
          aria-invalid={!!erroresCampos['nombre']}
          onChange={(e) => actualizarCampo('nombre', e.target.value)}
        />
        {erroresCampos['nombre'] && (
          <p className="text-sm text-destructive">{erroresCampos['nombre']}</p>
        )}
      </div>

      {medio && (
        <p className="text-xs text-muted-foreground">
          Los pagos ya registrados con este medio no cambian y lo muestran con el nombre nuevo.
        </p>
      )}

      {guardar.isError && (
        <p className="text-sm text-destructive">
          {guardar.error instanceof ErrorApiCliente
            ? guardar.error.message
            : medio
              ? 'No se pudo modificar el medio de pago.'
              : 'No se pudo registrar el medio de pago.'}
        </p>
      )}
      <Button type="submit" disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : medio ? 'Guardar cambios' : 'Registrar medio de pago'}
      </Button>
    </form>
  );
}

// HU-19, HU-20 y HU-33: el catálogo de medios de pago, con el alta y la modificación en una ventana
// que se abre desde el botón o desde cada fila.
export function RegistrarMedioPago() {
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<MedioPago | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Medios de pago</h1>
        <p className="text-sm text-muted-foreground">
          Registrá los medios con los que se puede cobrar un evento. Todos se pueden usar en
          cualquier cobro.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setAviso(null);
            setAbierto(true);
          }}
        >
          <Plus /> Nuevo medio de pago
        </Button>
        {aviso && (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" /> {aviso}
          </p>
        )}
      </div>

      <VentanaFormulario
        abierto={abierto}
        onCambiarAbierto={setAbierto}
        titulo="Nuevo medio de pago"
        descripcion="Se puede usar en cualquier cobro."
      >
        {/* La key vacía el formulario cada vez que se abre la ventana. */}
        <FormularioMedioPago
          key={String(abierto)}
          onGuardado={(nombre) => {
            setAviso(`«${nombre}» quedó registrado y ya se puede usar al cobrar.`);
            setAbierto(false);
          }}
        />
      </VentanaFormulario>

      <VentanaFormulario
        abierto={enEdicion !== null}
        onCambiarAbierto={(abiertoEdicion) => !abiertoEdicion && setEnEdicion(null)}
        titulo="Modificar medio de pago"
        descripcion="Cambiá el nombre del medio de pago."
      >
        {/* Se desmonta al cerrar: cada apertura arranca con los datos guardados del medio. */}
        {enEdicion && (
          <FormularioMedioPago
            key={enEdicion.id}
            medio={enEdicion}
            onGuardado={(nombre) => {
              setAviso(`«${nombre}» quedó modificado.`);
              setEnEdicion(null);
            }}
          />
        )}
      </VentanaFormulario>

      <ListadoMediosPago
        onModificar={(medio) => {
          setAviso(null);
          setEnEdicion(medio);
        }}
      />
    </div>
  );
}
