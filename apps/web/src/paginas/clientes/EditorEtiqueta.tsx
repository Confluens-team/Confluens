import type { Etiqueta } from '@confluens/shared';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { EtiquetaCliente } from '@/components/EtiquetaCliente';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAsignarEtiqueta } from '@/hooks/use-clientes';
import { useCrearEtiqueta } from '@/hooks/use-etiquetas';

// Id del <datalist> con las etiquetas existentes, que ListadoClientes renderiza una sola vez.
export const ID_LISTA_ETIQUETAS = 'etiquetas-de-clientes';

// Asigna la etiqueta de un cliente desde su fila. Si el texto coincide con una etiqueta existente
// (sin distinguir mayúsculas) se usa esa; si no, se crea y se asigna (dominio.md).
export function EditorEtiqueta({
  clienteId,
  etiqueta,
  existentes,
}: {
  clienteId: number;
  etiqueta: Etiqueta | null;
  existentes: Etiqueta[];
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const asignar = useAsignarEtiqueta();
  const crear = useCrearEtiqueta();
  const ocupado = asignar.isPending || crear.isPending;
  const error = asignar.error ?? crear.error;

  function abrir() {
    asignar.reset();
    crear.reset();
    setTexto(etiqueta?.nombre ?? '');
    setEditando(true);
  }

  async function guardar() {
    const nombre = texto.trim();
    if (!nombre) return;
    const existente = existentes.find((e) => e.nombre.toLowerCase() === nombre.toLowerCase());
    const destino = existente ?? (await crear.mutateAsync({ nombre }));
    await asignar.mutateAsync({ clienteId, etiquetaId: destino.id });
    setEditando(false);
  }

  async function quitar() {
    await asignar.mutateAsync({ clienteId, etiquetaId: null });
    setEditando(false);
  }

  if (!editando) {
    return (
      <div className="flex items-center gap-1.5">
        <EtiquetaCliente etiqueta={etiqueta} />
        <Button
          variant="ghost"
          size="xs"
          onClick={abrir}
          aria-label={etiqueta ? 'Cambiar etiqueta' : 'Asignar etiqueta'}
        >
          {etiqueta ? <Pencil /> : <Plus />}
          {!etiqueta && 'Asignar'}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex min-w-56 flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar().catch(() => undefined);
      }}
    >
      <Input
        autoFocus
        list={ID_LISTA_ETIQUETAS}
        value={texto}
        maxLength={40}
        placeholder="Ej.: Empresa1"
        aria-label="Etiqueta del cliente"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditando(false);
        }}
        className="h-8"
      />
      <div className="flex flex-wrap gap-1">
        <Button type="submit" size="xs" disabled={ocupado || !texto.trim()}>
          Guardar
        </Button>
        {etiqueta && (
          <Button
            type="button"
            variant="destructive"
            size="xs"
            disabled={ocupado}
            onClick={() => void quitar().catch(() => undefined)}
          >
            Quitar
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={ocupado}
          onClick={() => setEditando(false)}
        >
          Cancelar
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error.message}</p>}
    </form>
  );
}
