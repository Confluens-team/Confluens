import { MessageSquareText } from 'lucide-react';

/**
 * Lo que contó el cliente en la consulta de un evento social (pedidos, ideas, dudas). Solo se lee:
 * lo escribió el cliente. Sin comentarios no se muestra nada.
 */
export function ComentariosDelCliente({ comentarios }: { comentarios: string | null }) {
  if (!comentarios) return null;
  return (
    <section className="rounded-xl bg-dorado/10 p-5 ring-1 ring-dorado/30">
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <MessageSquareText className="size-4 text-dorado" /> Comentarios del cliente
      </h3>
      <p className="mt-2 text-sm whitespace-pre-line text-foreground/90">{comentarios}</p>
    </section>
  );
}
