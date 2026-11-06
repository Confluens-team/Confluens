import { esquemaRolPersonal, type RolPersonal } from '@confluens/shared';
import { useState } from 'react';

import { Label } from '@/components/ui/label';
import { useUsuarios } from '@/hooks/use-usuarios';
import { formatearFecha } from '@/lib/formato';
import { NOMBRES_DE_ROL } from '@/lib/roles';
import { CLASES_SELECT } from '@/paginas/eventos/clases-select';

// HU-31 del Sprint 4: los usuarios del personal con su correo, su rol y su fecha de alta, por rol y
// después por correo, con filtro por rol. Los clientes no aparecen: están en Clientes.
export function ListadoPersonal() {
  const [rol, setRol] = useState<RolPersonal | undefined>(undefined);
  const { data: usuarios, isLoading, isError } = useUsuarios(rol);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-medium">Usuarios del personal</h2>
        <div className="w-56 space-y-1.5">
          <Label htmlFor="personal-filtro-rol">Rol</Label>
          <select
            id="personal-filtro-rol"
            className={CLASES_SELECT}
            value={rol ?? ''}
            onChange={(e) => setRol(e.target.value ? (e.target.value as RolPersonal) : undefined)}
          >
            <option value="">Todos los roles</option>
            {esquemaRolPersonal.options.map((opcion) => (
              <option key={opcion} value={opcion}>
                {NOMBRES_DE_ROL[opcion]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {isError && (
        <p className="text-sm text-destructive">No se pudo cargar el listado del personal.</p>
      )}
      {usuarios && usuarios.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {rol ? 'No hay usuarios con ese rol.' : 'Todavía no hay usuarios del personal.'}
        </p>
      )}
      {usuarios && usuarios.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[0.65rem] tracking-[0.15em] text-muted-foreground uppercase">
                <th className="px-3 py-2 font-semibold">Correo</th>
                <th className="px-3 py-2 font-semibold">Rol</th>
                <th className="px-3 py-2 font-semibold">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td className="px-3 py-2.5 font-medium">{usuario.email}</td>
                  <td className="px-3 py-2.5">{NOMBRES_DE_ROL[usuario.rol]}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {formatearFecha(new Date(usuario.creadoEn))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
