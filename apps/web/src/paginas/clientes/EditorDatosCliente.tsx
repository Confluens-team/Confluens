import {
  type ClienteConResumen,
  esquemaModificarCliente,
  type ModificarCliente,
} from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { type Resolver, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useModificarCliente } from '@/hooks/use-clientes';
import { ErrorApiCliente } from '@/lib/api';
import { ariaDeCampo, idDeError } from '@/lib/campo-accesible';

type Campos = { nombre: string; apellido: string; telefono: string; correo: string };

function Campo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-xs text-muted-foreground">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idDeError(id)} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// HU-17: el personal corrige nombre, apellido y teléfono de cualquier cliente. El correo solo si el
// cliente no tiene cuenta: en uno con cuenta es su usuario para iniciar sesión y lo cambia él, así
// que se muestra de solo lectura y no se envía. La validación es la misma que hace la API.
export function EditorDatosCliente({ cliente }: { cliente: ClienteConResumen }) {
  const [editando, setEditando] = useState(false);
  const modificar = useModificarCliente();
  const correoEditable = cliente.usuarioId === null;

  // El apellido pasa por un preprocess (vacío = null) y su tipo de entrada queda como unknown: el
  // formulario lo maneja como texto, así que se ajusta el tipo del resultado del resolver.
  type ResultadoResolver = ReturnType<Resolver<Campos, unknown, ModificarCliente>>;
  const resolver: Resolver<Campos, unknown, ModificarCliente> = (valores, contexto, opciones) =>
    zodResolver(esquemaModificarCliente)(
      correoEditable ? valores : { ...valores, correo: undefined },
      contexto,
      {
        ...opciones,
        names: opciones.names?.filter((campo) => correoEditable || campo !== 'correo'),
      },
    ) as unknown as ResultadoResolver;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Campos, unknown, ModificarCliente>({ resolver });

  function abrir() {
    modificar.reset();
    reset({
      nombre: cliente.nombre,
      apellido: cliente.apellido ?? '',
      telefono: cliente.telefono,
      correo: cliente.correo,
    });
    setEditando(true);
  }

  const guardar = handleSubmit((datos) =>
    modificar.mutate(
      { clienteId: cliente.id, ...datos, correo: correoEditable ? datos.correo : undefined },
      { onSuccess: () => setEditando(false) },
    ),
  );

  if (!editando) {
    return (
      <Button variant="outline" size="sm" onClick={abrir}>
        <Pencil /> Modificar datos
      </Button>
    );
  }

  const errorDelServidor =
    modificar.error instanceof ErrorApiCliente
      ? modificar.error.message
      : modificar.error
        ? 'No se pudieron guardar los cambios.'
        : null;

  return (
    <form
      noValidate
      onSubmit={(e) => void guardar(e)}
      className="grid gap-4 rounded-lg bg-muted/40 p-4 ring-1 ring-border sm:grid-cols-2"
    >
      <Campo id="cli-nombre" etiqueta="Nombre o razón social" error={errors.nombre?.message}>
        <Input
          id="cli-nombre"
          autoFocus
          autoComplete="off"
          {...ariaDeCampo('cli-nombre', errors.nombre?.message)}
          {...register('nombre')}
        />
      </Campo>
      <Campo
        id="cli-apellido"
        etiqueta="Apellido"
        error={errors.apellido?.message}
        ayuda="Dejalo vacío si es una razón social."
      >
        <Input
          id="cli-apellido"
          autoComplete="off"
          {...ariaDeCampo('cli-apellido', errors.apellido?.message, 'cli-apellido-ayuda')}
          {...register('apellido')}
        />
      </Campo>
      <Campo id="cli-telefono" etiqueta="Celular (WhatsApp)" error={errors.telefono?.message}>
        <Input
          id="cli-telefono"
          type="tel"
          autoComplete="off"
          {...ariaDeCampo('cli-telefono', errors.telefono?.message)}
          {...register('telefono')}
        />
      </Campo>
      <Campo
        id="cli-correo"
        etiqueta="Correo"
        error={errors.correo?.message}
        ayuda={
          correoEditable
            ? undefined
            : 'El cliente tiene cuenta: este correo es su usuario y lo cambia él desde su cuenta.'
        }
      >
        <Input
          id="cli-correo"
          type="email"
          autoComplete="off"
          readOnly={!correoEditable}
          {...ariaDeCampo(
            'cli-correo',
            errors.correo?.message,
            correoEditable ? undefined : 'cli-correo-ayuda',
          )}
          {...register('correo')}
        />
      </Campo>

      {errorDelServidor && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2"
        >
          {errorDelServidor}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={modificar.isPending}>
          {modificar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={modificar.isPending}
          onClick={() => setEditando(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
