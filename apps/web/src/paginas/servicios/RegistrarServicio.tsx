import { esquemaCrearServicio } from '@confluens/shared';
import { useState } from 'react';

import { ErrorApiCliente } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCrearServicio, useServicios } from '@/hooks/use-servicios';

const formateadorPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const valoresIniciales = {
  nombre: '',
  descripcion: '',
  unidadMedida: '',
  precio: '',
  porPersona: false,
  tercerizado: false,
  // HU-11: un tercerizado puede no tener precio fijo todavía. No viaja: se traduce a precio null.
  aCotizar: false,
};

// Estado del formulario con useState controlado en vez de React Hook Form, mismo criterio que
// ConsultarSalones.tsx (HU-01). El motivo original era que los componentes ui/* de shadcn no
// usaban React.forwardRef y RHF.register() no podía engancharles un ref; Input y Textarea ya lo
// usan, así que migrar esto a RHF es posible, pero no hace falta para HU-13/HU-14. Acá además se
// valida el body a mano con esquemaCrearServicio antes de enviarlo, para dar el mismo mensaje de
// error que devolvería el servidor sin esperar el round-trip.
export function RegistrarServicio() {
  const { data: servicios, isLoading, isError } = useServicios();
  const crearServicio = useCrearServicio();

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

    // Se valida con el mismo schema que usa el servidor (packages/shared): si el body no pasa
    // acá, tampoco pasaría la API, así que se evita el request y se muestra el error al toque.
    const { aCotizar, ...cuerpo } = valores;
    const resultado = esquemaCrearServicio.safeParse({
      ...cuerpo,
      precio: aCotizar && cuerpo.tercerizado ? null : cuerpo.precio,
    });
    if (!resultado.success) {
      const errores: Record<string, string> = {};
      for (const issue of resultado.error.issues) {
        errores[String(issue.path[0])] = issue.message;
      }
      setErroresCampos(errores);
      return;
    }

    setErroresCampos({});
    crearServicio.mutate(resultado.data, {
      onSuccess: () => setValores(valoresIniciales),
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Servicios</h1>
        <p className="text-sm text-muted-foreground">
          Registrá los servicios del catálogo para poder incorporarlos a los presupuestos (HU-32).
        </p>
      </div>

      <form onSubmit={manejarEnvio} className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={valores.nombre}
            onChange={(e) => actualizarCampo('nombre', e.target.value)}
          />
          {erroresCampos['nombre'] && (
            <p className="text-sm text-destructive">{erroresCampos['nombre']}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="descripcion">Descripción</Label>
          <Textarea
            id="descripcion"
            value={valores.descripcion}
            onChange={(e) => actualizarCampo('descripcion', e.target.value)}
          />
          {erroresCampos['descripcion'] && (
            <p className="text-sm text-destructive">{erroresCampos['descripcion']}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unidadMedida">Unidad de medida</Label>
          <Input
            id="unidadMedida"
            placeholder="persona, unidad, etc."
            value={valores.unidadMedida}
            onChange={(e) => actualizarCampo('unidadMedida', e.target.value)}
          />
          {erroresCampos['unidadMedida'] && (
            <p className="text-sm text-destructive">{erroresCampos['unidadMedida']}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="precio">Precio (sin IVA)</Label>
          <Input
            id="precio"
            inputMode="decimal"
            placeholder={valores.aCotizar ? 'A cotizar' : '0.00'}
            disabled={valores.aCotizar}
            value={valores.aCotizar ? '' : valores.precio}
            onChange={(e) => actualizarCampo('precio', e.target.value)}
          />
          {erroresCampos['precio'] && (
            <p className="text-sm text-destructive">{erroresCampos['precio']}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="porPersona"
            checked={valores.porPersona}
            onCheckedChange={(marcado) => actualizarCampo('porPersona', marcado === true)}
          />
          <Label htmlFor="porPersona">Se cobra por persona</Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="tercerizado"
            checked={valores.tercerizado}
            onCheckedChange={(marcado) => {
              actualizarCampo('tercerizado', marcado === true);
              if (marcado !== true) actualizarCampo('aCotizar', false);
            }}
          />
          <Label htmlFor="tercerizado">
            Tercerizado (suma al total, pero no recibe el incremento mensual)
          </Label>
        </div>

        {valores.tercerizado && (
          <div className="flex items-center gap-2 pl-6">
            <Checkbox
              id="aCotizar"
              checked={valores.aCotizar}
              onCheckedChange={(marcado) => actualizarCampo('aCotizar', marcado === true)}
            />
            <Label htmlFor="aCotizar">
              A cotizar (sin precio fijo: en el presupuesto va sin importe y no suma)
            </Label>
          </div>
        )}

        {crearServicio.isError && (
          <p className="text-sm text-destructive">
            {crearServicio.error instanceof ErrorApiCliente
              ? crearServicio.error.message
              : 'No se pudo registrar el servicio.'}
          </p>
        )}

        <Button type="submit" disabled={crearServicio.isPending}>
          {crearServicio.isPending ? 'Guardando…' : 'Registrar servicio'}
        </Button>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Catálogo actual</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && <p className="text-sm text-destructive">No se pudo cargar el catálogo.</p>}
        {servicios && servicios.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay servicios registrados.</p>
        )}
        <ul className="divide-y rounded-lg border">
          {servicios?.map((servicio) => (
            <li key={servicio.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium">{servicio.nombre}</p>
                <p className="text-muted-foreground">
                  {servicio.descripcion} — {servicio.unidadMedida}
                  {servicio.porPersona ? ' (por persona)' : ''}
                  {servicio.tercerizado ? ' (tercerizado)' : ''}
                </p>
              </div>
              <span className="font-medium">
                {servicio.precio === null
                  ? 'A cotizar'
                  : formateadorPrecio.format(Number(servicio.precio))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
