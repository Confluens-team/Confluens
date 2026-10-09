import { Mail, Phone, Search } from 'lucide-react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { useClientes } from '@/hooks/use-clientes';
import { useEtiquetas } from '@/hooks/use-etiquetas';
import { formatearFecha, nombreCompleto } from '@/lib/formato';

import { EditorEtiqueta, ID_LISTA_ETIQUETAS } from './EditorEtiqueta';

// Clientes del panel del administrador: la ficha comercial, si tiene cuenta en el canal público,
// cuántos eventos y solicitudes lleva y su etiqueta interna. Lo único editable es la etiqueta: los
// datos de contacto los mantiene el cliente desde su cuenta.
export function ListadoClientes() {
  const clientes = useClientes();
  const etiquetas = useEtiquetas();
  const [busqueda, setBusqueda] = useState('');

  const texto = busqueda.trim().toLowerCase();
  const filtrados = (clientes.data ?? []).filter(
    (c) =>
      !texto ||
      nombreCompleto(c).toLowerCase().includes(texto) ||
      c.correo.toLowerCase().includes(texto) ||
      c.telefono.includes(texto) ||
      (c.etiqueta?.nombre.toLowerCase().includes(texto) ?? false),
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email, teléfono o etiqueta"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
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
            {filtrados.length} de {clientes.data.length} clientes
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
                {filtrados.map((cliente) => (
                  <tr key={cliente.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{nombreCompleto(cliente)}</p>
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
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {clientes.data.length === 0
                        ? 'Todavía no hay clientes.'
                        : 'Ningún cliente coincide con la búsqueda.'}
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
