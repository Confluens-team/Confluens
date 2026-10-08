// Clases del <input> de components/ui: no hay un <Select> en el proyecto (shadcn trae uno con
// radix, pero los catálogos de estas pantallas son de 3 opciones y el nativo ya da teclado, lector
// de pantalla y el selector del celular, igual que el de países en AccesoCliente.tsx). Lo comparten
// el medio de pago (CuentaDelEvento) y la distribución (DetalleEvento).
export const CLASES_SELECT =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30';
