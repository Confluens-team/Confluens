import { esquemaCredenciales, type Credenciales } from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ariaDeCampo, idDeError } from '@/lib/campo-accesible';
import { ErrorApiCliente } from '@/lib/api';
import { useIniciarSesion } from '@/hooks/use-sesion';

// No hay un componente <Form> genérico de shadcn en este proyecto: el registry de
// shadcn con el estilo configurado ("radix-nova") no trae ese item para agregar
// (se comprobó con `npx shadcn view form`: no devuelve archivos). En vez de escribir
// una abstracción propia para un único formulario, se usa react-hook-form
// directamente sobre Input/Label — más simple y sin la complejidad de mantener un
// wrapper para un solo caso de uso (ver CLAUDE.md: no crear abstracciones para
// operaciones puntuales).
export function IniciarSesion() {
  const navigate = useNavigate();
  const iniciarSesion = useIniciarSesion();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Credenciales>({ resolver: zodResolver(esquemaCredenciales) });

  const onSubmit = handleSubmit((credenciales) => {
    iniciarSesion.mutate(credenciales);
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border p-6"
      >
        <h1 className="text-xl font-semibold">Confluens</h1>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            {...ariaDeCampo('email', errors.email?.message)}
            {...register('email')}
          />
          {/* AC4 de la auditoría de accesibilidad: el error queda asociado al input y se anuncia. */}
          {errors.email && (
            <p id={idDeError('email')} role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contrasena">Contraseña</Label>
          <Input
            id="contrasena"
            type="password"
            autoComplete="current-password"
            {...ariaDeCampo('contrasena', errors.contrasena?.message)}
            {...register('contrasena')}
          />
          {errors.contrasena && (
            <p id={idDeError('contrasena')} role="alert" className="text-sm text-destructive">
              {errors.contrasena.message}
            </p>
          )}
        </div>

        {iniciarSesion.isError && (
          // Mensaje genérico, igual que el backend (criterio 2 de HU-27): nunca se
          // muestra si falló el email o la contraseña, aunque la API sí devuelva
          // un mensaje propio — se prioriza que la UI no invente su propio texto
          // que termine filtrando información distinta a la del backend.
          <p className="text-sm text-destructive">
            {iniciarSesion.error instanceof ErrorApiCliente
              ? iniciarSesion.error.message
              : 'No se pudo iniciar sesión'}
          </p>
        )}

        <Button type="submit" disabled={iniciarSesion.isPending}>
          {iniciarSesion.isPending ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <button
          type="button"
          onClick={() => navigate('/olvide-contrasena')}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </main>
  );
}
