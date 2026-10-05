import {
  esquemaCredenciales,
  esquemaRegistroCliente,
  type Credenciales,
  type RegistroCliente,
  type Sesion,
} from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIniciarSesion, useRegistrarCliente } from '@/hooks/use-sesion';
import { ErrorApiCliente } from '@/lib/api';
import { FOTOS } from '@/lib/fotos';
import { cn } from '@/lib/utils';

type Modo = 'registro' | 'ingreso';

function Campo({
  id,
  etiqueta,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function mensajeDeError(error: unknown, porDefecto: string) {
  return error instanceof ErrorApiCliente ? error.message : porDefecto;
}

function FormularioRegistro({
  onListo,
  onIrAIngreso,
}: {
  onListo: (sesion: Sesion) => void;
  onIrAIngreso: () => void;
}) {
  const registrar = useRegistrarCliente();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistroCliente>({ resolver: zodResolver(esquemaRegistroCliente) });

  const onSubmit = handleSubmit((datos) => registrar.mutate(datos, { onSuccess: onListo }));
  const emailYaRegistrado =
    registrar.error instanceof ErrorApiCliente && registrar.error.code === 'CONFLICT';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="reg-nombre" etiqueta="Nombre" error={errors.nombre?.message}>
          <Input
            id="reg-nombre"
            autoComplete="given-name"
            className="h-10"
            {...register('nombre')}
          />
        </Campo>
        <Campo id="reg-apellido" etiqueta="Apellido" error={errors.apellido?.message}>
          <Input
            id="reg-apellido"
            autoComplete="family-name"
            className="h-10"
            {...register('apellido')}
          />
        </Campo>
      </div>
      <Campo id="reg-email" etiqueta="Email" error={errors.email?.message}>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          className="h-10"
          {...register('email')}
        />
      </Campo>
      <Campo id="reg-telefono" etiqueta="Celular (WhatsApp)" error={errors.telefono?.message}>
        <Input
          id="reg-telefono"
          type="tel"
          autoComplete="tel"
          placeholder="351 15 612-3456"
          className="h-10"
          {...register('telefono')}
        />
      </Campo>
      <Campo id="reg-contrasena" etiqueta="Contraseña" error={errors.contrasena?.message}>
        <Input
          id="reg-contrasena"
          type="password"
          autoComplete="new-password"
          className="h-10"
          {...register('contrasena')}
        />
      </Campo>

      {registrar.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mensajeDeError(registrar.error, 'No se pudo crear la cuenta.')}{' '}
          {emailYaRegistrado && (
            <button type="button" className="font-medium underline" onClick={onIrAIngreso}>
              Ingresar
            </button>
          )}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-1 h-11" disabled={registrar.isPending}>
        {registrar.isPending ? 'Creando cuenta…' : 'Crear cuenta y continuar'}
      </Button>
    </form>
  );
}

function FormularioIngreso({ onListo }: { onListo: (sesion: Sesion) => void }) {
  const iniciarSesion = useIniciarSesion();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Credenciales>({ resolver: zodResolver(esquemaCredenciales) });

  const onSubmit = handleSubmit((credenciales) =>
    iniciarSesion.mutate(credenciales, { onSuccess: onListo }),
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Campo id="ing-email" etiqueta="Email" error={errors.email?.message}>
        <Input
          id="ing-email"
          type="email"
          autoComplete="username"
          className="h-10"
          {...register('email')}
        />
      </Campo>
      <Campo id="ing-contrasena" etiqueta="Contraseña" error={errors.contrasena?.message}>
        <Input
          id="ing-contrasena"
          type="password"
          autoComplete="current-password"
          className="h-10"
          {...register('contrasena')}
        />
      </Campo>

      {/* Mismo mensaje genérico que devuelve la API (criterio 2 de HU-27). */}
      {iniciarSesion.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mensajeDeError(iniciarSesion.error, 'No se pudo iniciar sesión.')}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-1 h-11" disabled={iniciarSesion.isPending}>
        {iniciarSesion.isPending ? 'Ingresando…' : 'Ingresar y continuar'}
      </Button>
    </form>
  );
}

// Acceso del Cliente desde la landing: crea la cuenta (email, teléfono y contraseña) o inicia
// sesión con una existente, y al terminar sigue al cotizador con precios.
export function AccesoCliente({
  abierto,
  onCerrar,
  onIngreso,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onIngreso: (sesion: Sesion) => void;
}) {
  const [modo, setModo] = useState<Modo>('registro');

  return (
    <Dialog.Root open={abierto} onOpenChange={(abrir) => !abrir && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bordo-oscuro/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 grid max-h-[95vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-papel shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 md:grid-cols-[1fr_1.15fr]">
          <div className="relative hidden overflow-hidden rounded-l-2xl md:block">
            <img src={FOTOS.emplatado} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-bordo-oscuro via-bordo-oscuro/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8 text-crema">
              <p className="text-xs font-semibold tracking-[0.3em] text-dorado uppercase">
                Cotizador online
              </p>
              <p className="mt-3 font-display text-2xl leading-snug italic">
                Precios vigentes, salones y gastronomía en un solo lugar.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <Logo />
              <Dialog.Close
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="size-5" />
              </Dialog.Close>
            </div>

            <Dialog.Title className="mt-6 text-2xl font-semibold text-bordo">
              {modo === 'registro' ? 'Creá tu cuenta' : 'Ingresá a tu cuenta'}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {modo === 'registro'
                ? 'Solo te pedimos lo necesario para enviarte el presupuesto.'
                : 'Con el email y la contraseña con los que te registraste.'}
            </Dialog.Description>

            <div className="mt-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
              {(['registro', 'ingreso'] as const).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => setModo(opcion)}
                  className={cn(
                    'rounded-md py-2 transition-colors',
                    modo === opcion
                      ? 'bg-card text-bordo shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opcion === 'registro' ? 'Soy nuevo' : 'Ya tengo cuenta'}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {modo === 'registro' ? (
                <FormularioRegistro onListo={onIngreso} onIrAIngreso={() => setModo('ingreso')} />
              ) : (
                <FormularioIngreso onListo={onIngreso} />
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
