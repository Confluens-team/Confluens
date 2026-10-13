import { esquemaRestablecerContrasena, type Sesion } from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ariaDeCampo, idDeError } from '@/lib/campo-accesible';
import { useRestablecerContrasena } from '@/hooks/use-sesion';
import { ErrorApiCliente } from '@/lib/api';

import { TarjetaAcceso } from './TarjetaAcceso';

// La contraseña se escribe dos veces para no quedar con una que no se recuerda. La repetición se
// controla solo en la web: a la API viaja el body de esquemaRestablecerContrasena.
const esquemaFormulario = esquemaRestablecerContrasena
  .pick({ contrasena: true })
  .extend({ repetir: z.string() })
  .refine((datos) => datos.contrasena === datos.repetir, {
    error: 'Las contraseñas no coinciden',
    path: ['repetir'],
  });
type CamposFormulario = z.infer<typeof esquemaFormulario>;

// Pantalla a la que lleva el enlace del correo (C8 de HU-48). Al terminar, la sesión queda iniciada.
export function RestablecerContrasena({
  token,
  onListo,
  onPedirOtro,
  onVolver,
}: {
  token: string | null;
  onListo: (sesion: Sesion) => void;
  onPedirOtro: () => void;
  onVolver: () => void;
}) {
  const restablecer = useRestablecerContrasena();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CamposFormulario>({ resolver: zodResolver(esquemaFormulario) });

  const onSubmit = handleSubmit(({ contrasena }) =>
    restablecer.mutate({ token: token ?? '', contrasena }, { onSuccess: onListo }),
  );

  // 422: el enlace venció o ya se usó. Cualquier otro error es de conexión o del servidor.
  const enlaceInvalido =
    !token ||
    (restablecer.error instanceof ErrorApiCliente &&
      restablecer.error.code === 'BUSINESS_RULE_VIOLATION');

  if (enlaceInvalido) {
    return (
      <TarjetaAcceso
        titulo="El enlace no sirve"
        descripcion="Venció, ya se usó o está incompleto."
        onVolver={onVolver}
      >
        <Button size="lg" className="h-11 w-full" onClick={onPedirOtro}>
          Pedir un enlace nuevo
        </Button>
      </TarjetaAcceso>
    );
  }

  return (
    <TarjetaAcceso
      titulo="Elegí tu contraseña nueva"
      descripcion="Al guardarla, entrás directo a tu cuenta."
      onVolver={onVolver}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nueva-contrasena">Contraseña nueva</Label>
          <Input
            id="nueva-contrasena"
            type="password"
            autoComplete="new-password"
            className="h-10"
            {...ariaDeCampo('nueva-contrasena', errors.contrasena?.message)}
            {...register('contrasena')}
          />
          {/* AC4 de la auditoría de accesibilidad: el error queda asociado al input y se anuncia. */}
          {errors.contrasena && (
            <p id={idDeError('nueva-contrasena')} role="alert" className="text-xs text-destructive">
              {errors.contrasena.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="repetir-contrasena">Repetí la contraseña</Label>
          <Input
            id="repetir-contrasena"
            type="password"
            autoComplete="new-password"
            className="h-10"
            {...ariaDeCampo('repetir-contrasena', errors.repetir?.message)}
            {...register('repetir')}
          />
          {errors.repetir && (
            <p
              id={idDeError('repetir-contrasena')}
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.repetir.message}
            </p>
          )}
        </div>

        {restablecer.isError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            No se pudo guardar la contraseña. Probá de nuevo.
          </p>
        )}

        <Button type="submit" size="lg" className="h-11" disabled={restablecer.isPending}>
          {restablecer.isPending ? 'Guardando…' : 'Guardar y entrar'}
        </Button>
      </form>
    </TarjetaAcceso>
  );
}
