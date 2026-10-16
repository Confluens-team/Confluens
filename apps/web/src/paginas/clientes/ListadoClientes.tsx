import { Mail, Phone, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import { useClientes } from '@/hooks/use-clientes';
import { useEtiquetas } from '@/hooks/use-etiquetas';
import { formatearFecha, nombreCompleto } from '@/lib/formato';

import { EditorEtiqueta, ID_LISTA_ETIQUETAS } from './EditorEtiqueta';
import { FichaCliente } from './FichaCliente';

// Clientes del panel (HU-16): la ficha comercial, si tiene cuenta en el canal público, cuántos
// eventos y solicitudes lleva y su etiqueta interna, en orden alfabético por apellido y nombre.
// Lo único editable es la etiqueta: los datos de contacto los mantiene el cliente desde su cuenta.
// Cada nombre abre la ficha del cliente.
export function ListadoClientes() {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);
  const clientes = useClientes({ busqueda });
  const etiquetas = useEtiquetas();

  // La búsqueda la resuelve la API: espera a que se deje de escribir para no pedir una vez por tecla.
  useEffect(() => {
    const espera = setTimeout(() => setBusqueda(texto.trim()), 300);
    return () => clearTimeout(espera);
  }, [texto]);

  if (abierto !== null) {
    return (
      <FichaCliente
        key={abierto}
        clienteId={abierto}
        onVolver={() => {
          setAbierto(null);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const lista = clientes.data ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email, teléfono o etiqueta"
          aria-label="Buscar clientes"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="h-10 bg-card pl-9"
        />
      </div>

      {clientes.isLoading && <p className="text-sm text-muted-foreground">Cargando clientes…</p>}
      {clientes.isError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudieron cargar los clientes.
        </p>
      )}

      {clientes.data && (
        <>
          <datalist id={ID_LISTA_ETIQUETAS}>
            {etiquetas.data?.map((etiqueta) => (
              <option key={etiqueta.id} value={etiqueta.nombre} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">
            {lista.length === 1 ? '1 cliente' : `${lista.length} clientes`}
            {busqueda && (lista.length === 1 ? ' coincide' : ' coinciden') + ' con la búsqueda'}
          </p>
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase">
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Etiqueta</th>
                  <th className="px-4 py-3 font-semibold">Contacto</th>
                  <th className="px-4 py-3 font-semibold">Cuenta web</th>
                  <th className="px-4 py-3 text-right font-semibold">Eventos</th>
                  <th className="px-4 py-3 text-right font-semibold">Solicitudes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((cliente) => (
                  <tr key={cliente.id} className="align-top">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setAbierto(cliente.id)}
                        className="text-left font-medium text-bordo underline-offset-2 hover:underline"
                        aria-label={`Ver la ficha de ${nombreCompleto(cliente)}`}
                      >
                        {nombreCompleto(cliente)}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        Desde el {formatearFecha(new Date(cliente.creadoEn))}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <EditorEtiqueta
                        clienteId={cliente.id}
                        etiqueta={cliente.etiqueta}
                        existentes={etiquetas.data ?? []}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <p className="flex items-center gap-1.5">
                        <Mail className="size-3.5" /> {cliente.correo}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone className="size-3.5" /> {cliente.telefono}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {cliente.usuarioId ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                          Registrado
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Sin cuenta
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{cliente.cantidadEventos}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {cliente.cantidadSolicitudes}
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {busqueda
                        ? 'Ningún cliente coincide con la búsqueda.'
                        : 'Todavía no hay clientes.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
