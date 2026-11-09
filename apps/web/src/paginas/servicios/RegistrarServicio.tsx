import { esquemaCrearServicio, esquemaModificarServicio, type Servicio } from '@confluens/shared';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { ErrorApiCliente } from '@/lib/api';
import { InputImporte } from '@/components/InputImporte';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { VentanaFormulario } from '@/components/VentanaFormulario';
import { useCrearServicio, useModificarServicio, useServicios } from '@/hooks/use-servicios';

import { IncrementoMensual } from './IncrementoMensual';

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
  // RN-11: se puede pedir continuo en salón (+20%) o en mesas con mozo (+30%).
  admiteModalidad: false,
  // HU-11: un tercerizado puede no tener precio fijo todavía. No viaja: se traduce a precio null.
  aCotizar: false,
  // Solo en la edición: el alta no la pide (la categoría nace en null).
  categoria: '',
};

// HU-32 del Sprint 4: al editar, el formulario arranca con los datos del servicio.
function valoresDe(servicio: Servicio): typeof valoresIniciales {
  return {
    nombre: servicio.nombre,
    descripcion: servicio.descripcion,
    unidadMedida: servicio.unidadMedida,
    precio: servicio.precio ?? '',
    porPersona: servicio.porPersona,
    tercerizado: servicio.tercerizado,
    admiteModalidad: servicio.admiteModalidad,
    aCotizar: servicio.precio === null,
    categoria: servicio.categoria ?? '',
  };
}

// Estado del formulario con useState controlado en vez de React Hook Form. El criterio se
// compartía con el filtro de ConsultarSalones.tsx, que ya no existe. El motivo original era que
// los componentes ui/* de shadcn no
// usaban React.forwardRef y RHF.register() no podía engancharles un ref; Input y Textarea ya lo
// usan, así que migrar esto a RHF es posible, pero no hace falta para HU-13/HU-14. Acá además se
// valida el body a mano con esquemaCrearServicio antes de enviarlo, para dar el mismo mensaje de
// error que devolvería el servidor sin esperar el round-trip.
//
// El mismo formulario sirve para el alta y, con `servicio`, para modificarlo (HU-32 del Sprint 4):
// cambian el schema con que se valida, la mutación y que la edición suma la categoría.
function FormularioServicio({
  servicio,
  onGuardado,
}: {
  servicio?: Servicio;
  onGuardado: () => void;
}) {
  const crearServicio = useCrearServicio();
  const modificarServicio = useModificarServicio();
  const guardar = servicio ? modificarServicio : crearServicio;

  const [valores, setValores] = useState(servicio ? valoresDe(servicio) : valoresIniciales);
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
    const { aCotizar, categoria, ...cuerpo } = valores;
    const datos = {
      ...cuerpo,
      precio: aCotizar && cuerpo.tercerizado ? null : cuerpo.precio,
      admiteModalidad: cuerpo.porPersona && cuerpo.admiteModalidad,
    };
    function mostrarErrores(issues: { path: PropertyKey[]; message: string }[]) {
      const errores: Record<string, string> = {};
      for (const issue of issues) errores[String(issue.path[0])] = issue.message;
      setErroresCampos(errores);
    }

    if (servicio) {
      const resultado = esquemaModificarServicio.safeParse({ ...datos, categoria });
      if (!resultado.success) return mostrarErrores(resultado.error.issues);
      setErroresCampos({});
      modificarServicio.mutate(
        { id: servicio.id, datos: resultado.data },
        { onSuccess: onGuardado },
      );
    } else {
      const resultado = esquemaCrearServicio.safeParse(datos);
      if (!resultado.success) return mostrarErrores(resultado.error.issues);
      setErroresCampos({});
      crearServicio.mutate(resultado.data, { onSuccess: onGuardado });
    }
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
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
        <InputImporte
          id="precio"
          sinSigno={valores.aCotizar}
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

      {/* RN-11: el recargo va sobre el precio base por persona, así que solo aplica a esos. */}
      {valores.porPersona && (
        <div className="flex items-center gap-2 pl-6">
          <Checkbox
            id="admiteModalidad"
            checked={valores.admiteModalidad}
            onCheckedChange={(marcado) => actualizarCampo('admiteModalidad', marcado === true)}
          />
          <Label htmlFor="admiteModalidad">
            Admite modalidad: continuo en salón (+20%) o en mesas con mozo (+30%)
          </Label>
        </div>
      )}

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

      {/* Agrupa el catálogo en la landing. Las del tarifario: Coffee breaks, Desayunos,
          Degustación, Lunch y cocktail, Almuerzo y cena. */}
      {servicio && (
        <div className="space-y-1.5">
          <Label htmlFor="categoria">Categoría</Label>
          <Input
            id="categoria"
            placeholder="Sin categoría"
            maxLength={60}
            value={valores.categoria}
            onChange={(e) => actualizarCampo('categoria', e.target.value)}
          />
          {erroresCampos['categoria'] && (
            <p className="text-sm text-destructive">{erroresCampos['categoria']}</p>
          )}
        </div>
      )}

      {servicio && (
        <p className="text-xs text-muted-foreground">
          Un cambio de precio no afecta los presupuestos ya emitidos: conservan el precio con que se
          armaron.
        </p>
      )}

      {guardar.isError && (
        <p className="text-sm text-destructive">
          {guardar.error instanceof ErrorApiCliente
            ? guardar.error.message
            : servicio
              ? 'No se pudo modificar el servicio.'
              : 'No se pudo registrar el servicio.'}
        </p>
      )}

      <Button type="submit" disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : servicio ? 'Guardar cambios' : 'Registrar servicio'}
      </Button>
    </form>
  );
}

// El catálogo de servicios. El alta y el incremento mensual se abren desde sus botones, en
// una ventana sobre el listado.
export function RegistrarServicio() {
  const { data: servicios, isLoading, isError } = useServicios();
  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<Servicio | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Servicios</h1>
        <p className="text-sm text-muted-foreground">
          Registrá los servicios del catálogo para poder incorporarlos a los presupuestos (HU-32).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setAbierto(true)}>
            <Plus /> Nuevo servicio
          </Button>
          <IncrementoMensual />
        </div>
      </div>

      <VentanaFormulario
        abierto={abierto}
        onCambiarAbierto={setAbierto}
        titulo="Nuevo servicio"
        descripcion="El servicio queda en el catálogo y se puede incorporar a los presupuestos."
      >
        {/* La key vacía el formulario cada vez que se abre la ventana. */}
        <FormularioServicio key={String(abierto)} onGuardado={() => setAbierto(false)} />
      </VentanaFormulario>

      <VentanaFormulario
        abierto={enEdicion !== null}
        onCambiarAbierto={(abiertoEdicion) => !abiertoEdicion && setEnEdicion(null)}
        titulo="Modificar servicio"
        descripcion="Los presupuestos nuevos o recalculados toman los datos nuevos."
      >
        {/* Se desmonta al cerrar: cada apertura arranca con los datos guardados del servicio. */}
        {enEdicion && (
          <FormularioServicio
            key={enEdicion.id}
            servicio={enEdicion}
            onGuardado={() => setEnEdicion(null)}
          />
        )}
      </VentanaFormulario>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Catálogo actual</h2>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && <p className="text-sm text-destructive">No se pudo cargar el catálogo.</p>}
        {servicios && servicios.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay servicios registrados.</p>
        )}
        <ul className="divide-y rounded-lg border">
          {servicios?.map((servicio) => (
            <li key={servicio.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium">{servicio.nombre}</p>
                <p className="text-muted-foreground">
                  {servicio.descripcion} — {servicio.unidadMedida}
                  {servicio.porPersona ? ' (por persona)' : ''}
                  {servicio.tercerizado ? ' (tercerizado)' : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-medium">
                  {servicio.precio === null
                    ? 'A cotizar'
                    : formateadorPrecio.format(Number(servicio.precio))}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Modificar ${servicio.nombre}`}
                  onClick={() => setEnEdicion(servicio)}
                >
                  <Pencil />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
