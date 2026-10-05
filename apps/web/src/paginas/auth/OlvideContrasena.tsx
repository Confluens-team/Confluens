import {
  esquemaSolicitarRestablecimiento,
  type SolicitarRestablecimiento,
} from '@confluens/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSolicitarRestablecimiento } from '@/hooks/use-sesion';

import { TarjetaAcceso } from './TarjetaAcceso';

// C8 de HU-48: pide el enlace para restablecer la contraseña. El mensaje de confirmación es el
// mismo exista o no la cuenta, igual que la respuesta de la API.
export function OlvideContrasena({ onVolver }: { onVolver: () => void }) {
  const solicitar = useSolicitarRestablecimiento();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SolicitarRestablecimiento>({
    resolver: zodResolver(esquemaSolicitarRestablecimiento),
  });

  const onSubmit = handleSubmit((datos) => solicitar.mutate(datos));

  if (solicitar.isSuccess) {
    return (
      <TarjetaAcceso
        titulo="Revisá tu correo"
        descripcion="Te mandamos un enlace para elegir una contraseña nueva."
        onVolver={onVolver}
      >
        <p className="text-sm">
          Si hay una cuenta con <span className="font-medium">{getValues('email')}</span>, en unos
          minutos te llega el enlace. Vence en 30 minutos y sirve una sola vez. Si no lo ves, revisá
          la carpeta de spam.
        </p>
      </TarjetaAcceso>
    );
  }

  return (
    <TarjetaAcceso
      titulo="Olvidé mi contraseña"
      descripcion="Ingresá el email de tu cuenta y te mandamos un enlace para elegir una nueva."
      onVolver={onVolver}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="olvido-email">Email</Label>
          <Input
            id="olvido-email"
            type="email"
            autoComplete="username"
            className="h-10"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {solicitar.isError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            No se pudo enviar el pedido. Probá de nuevo en unos minutos.
          </p>
        )}

        <Button type="submit" size="lg" className="h-11" disabled={solicitar.isPending}>
          {solicitar.isPending ? 'Enviando…' : 'Enviarme el enlace'}
        </Button>
      </form>
    </TarjetaAcceso>
  );
}
