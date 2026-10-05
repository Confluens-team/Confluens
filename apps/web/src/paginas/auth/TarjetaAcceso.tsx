import { Logo } from '@/components/Logo';

// Marco de las pantallas para restablecer la contraseña. Las usan el cliente y el personal, así
// que no cuelgan del sitio público ni del panel.
export function TarjetaAcceso({
  titulo,
  descripcion,
  onVolver,
  children,
}: {
  titulo: string;
  descripcion: string;
  onVolver: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-2xl bg-papel p-6 shadow-xl ring-1 ring-border sm:p-8">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold text-bordo">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
        <div className="mt-6">{children}</div>
        <button
          type="button"
          onClick={onVolver}
          className="mt-6 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          ← Volver
        </button>
      </div>
    </main>
  );
}
