import { esquemaCrearMedioPago } from '@confluens/shared';
import { CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VentanaFormulario } from '@/components/VentanaFormulario';
import { useCrearMedioPago } from '@/hooks/use-pagos';
import { ErrorApiCliente } from '@/lib/api';

import { ListadoMediosPago } from './ListadoMediosPago';

const valoresIniciales = { nombre: '', conFactura: false, sinFactura: false };

// HU-19: alta de un medio de pago. Además del nombre se elige en qué cobros se puede usar: con
// factura, sin factura o en los dos casos (RN-14, decisión del PO del 16/10/2026). Mismo patrón que
// RegistrarServicio: estado controlado y validación con el schema de shared antes de enviar, para
// mostrar el mismo error que devolvería la API sin esperar el round-trip.
function FormularioMedioPago({ onRegistrado }: { onRegistrado: (nombre: string) => void }) {
  const crearMedioPago = useCrearMedioPago();
  const [valores, setValores] = useState(valoresIniciales);
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});

  function actualizarCampo<K extends keyof typeof valoresIniciales>(
    campo: K,
    valor: (typeof valoresIniciales)[K],
  ) {
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
  }

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    const resultado = esquemaCrearMedioPago.safeParse(valores);
    if (!resultado.success) {
      const errores: Record<string, string> = {};
      for (const issue of resultado.error.issues) errores[String(issue.path[0])] = issue.message;
      setErroresCampos(errores);
      return;
    }
    setErroresCampos({});
    crearMedioPago.mutate(resultado.data, {
      onSuccess: (medio) => onRegistrado(medio.nombre),
    });
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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Se puede usar en cobros…</legend>
        <div className="flex items-center gap-2">
          <Checkbox
            id="medio-con-factura"
            checked={valores.conFactura}
            onCheckedChange={(marcado) => actualizarCampo('conFactura', marcado === true)}
          />
          <Label htmlFor="medio-con-factura">Con factura</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="medio-sin-factura"
            checked={valores.sinFactura}
            onCheckedChange={(marcado) => actualizarCampo('sinFactura', marcado === true)}
          />
          <Label htmlFor="medio-sin-factura">Sin factura</Label>
        </div>
        {erroresCampos['conFactura'] && (
          <p className="text-sm text-destructive">{erroresCampos['conFactura']}</p>
        )}
      </fieldset>

      {crearMedioPago.isError && (
        <p className="text-sm text-destructive">
          {crearMedioPago.error instanceof ErrorApiCliente
            ? crearMedioPago.error.message
            : 'No se pudo registrar el medio de pago.'}
        </p>
      )}
      <Button type="submit" disabled={crearMedioPago.isPending}>
        {crearMedioPago.isPending ? 'Registrando…' : 'Registrar medio de pago'}
      </Button>
    </form>
  );
}

// HU-19 y HU-20: el catálogo de medios de pago, con el alta en una ventana que se abre desde el
// botón.
export function RegistrarMedioPago() {
  const [abierto, setAbierto] = useState(false);
  const [registrado, setRegistrado] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Medios de pago</h1>
        <p className="text-sm text-muted-foreground">
          Registrá los medios con los que se puede cobrar un evento y en qué casos se pueden usar,
          según el cliente requiera factura o no (HU-19 y HU-20).
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setRegistrado(null);
            setAbierto(true);
          }}
        >
          <Plus /> Nuevo medio de pago
        </Button>
        {registrado && (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" /> «{registrado}» quedó registrado y ya se puede usar
            al cobrar.
          </p>
        )}
      </div>

      <VentanaFormulario
        abierto={abierto}
        onCambiarAbierto={setAbierto}
        titulo="Nuevo medio de pago"
        descripcion="Elegí en qué cobros se puede usar: con factura, sin factura o en los dos casos."
      >
        {/* La key vacía el formulario cada vez que se abre la ventana. */}
        <FormularioMedioPago
          key={String(abierto)}
          onRegistrado={(nombre) => {
            setRegistrado(nombre);
            setAbierto(false);
          }}
        />
      </VentanaFormulario>

      <ListadoMediosPago />
    </div>
  );
}
