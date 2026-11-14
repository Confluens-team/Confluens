import {
  esquemaRolPersonal,
  type EstadoDeConexion,
  MINUTOS_EN_LINEA,
  puedeAdministrarA,
  type RolPersonal,
  type Sesion,
  type Usuario,
  type UsuarioDelListado,
} from '@confluens/shared';
import { ArchiveRestore, Ban, KeyRound, Pencil } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCambiarEstadoUsuario, useUsuarios } from '@/hooks/use-usuarios';
import { ErrorApiCliente } from '@/lib/api';
import { formatearFecha, haceCuanto } from '@/lib/formato';
import { NOMBRES_DE_ROL } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { CLASES_SELECT } from '@/paginas/eventos/clases-select';

// Estado de conexión: la luz y su rótulo. El color no va solo: el rótulo también se lee.
const CONEXION: Record<EstadoDeConexion, { luz: string; etiqueta: string }> = {
  EnLinea: { luz: 'bg-emerald-500', etiqueta: 'En línea' },
  Ausente: { luz: 'bg-amber-400', etiqueta: 'Ausente' },
  SinSesion: { luz: 'bg-muted-foreground/40', etiqueta: 'Sin sesión' },
};

// Lo que dice el globito sobre la luz: cuánto hace de su última actividad.
function detalleDeConexion(usuario: UsuarioDelListado): string {
  if (!usuario.activo) return 'Dado de baja: no puede iniciar sesión';
  if (usuario.conexion === 'SinSesion') return 'No tiene una sesión abierta';
  const hace = haceCuanto(new Date(usuario.ultimaActividad!));
  return usuario.conexion === 'EnLinea'
    ? `Activo ${hace}`
    : `Sesión abierta, sin actividad desde ${hace} (más de ${MINUTOS_EN_LINEA} min)`;
}

function LuzDeConexion({ usuario }: { usuario: UsuarioDelListado }) {
  const { luz, etiqueta } = CONEXION[usuario.conexion];
  return (
    <span className="inline-flex items-center gap-2" title={detalleDeConexion(usuario)}>
      <span className={cn('size-2.5 rounded-full', luz)} aria-hidden />
      <span className="text-xs">{etiqueta}</span>
    </span>
  );
}

// HU-31 del Sprint 4: los usuarios del personal con su correo, su rol y su fecha de alta, por rol y
// después por correo, con filtro por rol. Los clientes no aparecen: están en Clientes.
// HU-30 y HU-31 del backlog (Sprint 5): cada fila se modifica, se da de baja o se reactiva, y el ADM
// le carga una contraseña nueva. Las acciones que la sesión no puede hacer no se muestran: el GG no
// toca a un ADM, nadie se da de baja a sí mismo y la contraseña de otro solo la cambia el ADM. La API
// aplica las mismas reglas, más la de que siempre quede un GG y un ADM activos.
export function ListadoPersonal({
  sesion,
  onModificar,
  onCambiarContrasena,
}: {
  sesion: Sesion;
  onModificar: (usuario: Usuario) => void;
  onCambiarContrasena: (usuario: Usuario) => void;
}) {
  const [rol, setRol] = useState<RolPersonal | undefined>(undefined);
  // Se refresca solo: la luz de conexión tiene que estar al día mientras se mira la pantalla.
  const { data: usuarios, isLoading, isError } = useUsuarios(rol, true);
  const cambiarEstado = useCambiarEstadoUsuario();
  // El usuario cuya baja se está confirmando en su fila.
  const [aDarDeBaja, setADarDeBaja] = useState<number | null>(null);

  function cambiar(usuario: Usuario, activo: boolean) {
    cambiarEstado.mutate({ id: usuario.id, activo }, { onSettled: () => setADarDeBaja(null) });
  }

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
      {cambiarEstado.isError && (
        <p className="text-sm text-destructive">
          {cambiarEstado.error instanceof ErrorApiCliente
            ? cambiarEstado.error.message
            : 'No se pudo cambiar el estado del usuario.'}
        </p>
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
                <th className="px-3 py-2 font-semibold">Conexión</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">Alta</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map((usuario) => {
                const propio = usuario.id === sesion.id;
                const administra = puedeAdministrarA(sesion.rol, usuario.rol);
                return (
                  <tr key={usuario.id} className={cn(!usuario.activo && 'text-muted-foreground')}>
                    <td className="px-3 py-2.5 font-medium">
                      {usuario.email}
                      {propio && <span className="ml-1 text-xs font-normal">(vos)</span>}
                    </td>
                    <td className="px-3 py-2.5">{NOMBRES_DE_ROL[usuario.rol]}</td>
                    <td className="px-3 py-2.5">
                      <LuzDeConexion usuario={usuario} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          usuario.activo
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {usuario.activo ? 'Activo' : 'Dado de baja'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatearFecha(new Date(usuario.creadoEn))}
                    </td>
                    <td className="px-1 py-1 text-right whitespace-nowrap">
                      {aDarDeBaja === usuario.id ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          ¿Dar de baja? Se cierran sus sesiones.
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={cambiarEstado.isPending}
                            onClick={() => cambiar(usuario, false)}
                          >
                            Sí
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setADarDeBaja(null)}>
                            No
                          </Button>
                        </span>
                      ) : (
                        <>
                          {administra && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Modificar ${usuario.email}`}
                              title="Modificar"
                              onClick={() => onModificar(usuario)}
                            >
                              <Pencil />
                            </Button>
                          )}
                          {sesion.rol === 'ADMINISTRADOR_SISTEMA' && !propio && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Cambiar la contraseña de ${usuario.email}`}
                              title="Cambiar contraseña"
                              onClick={() => onCambiarContrasena(usuario)}
                            >
                              <KeyRound />
                            </Button>
                          )}
                          {administra && !propio && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={cambiarEstado.isPending}
                              aria-label={
                                usuario.activo
                                  ? `Dar de baja a ${usuario.email}`
                                  : `Reactivar a ${usuario.email}`
                              }
                              title={usuario.activo ? 'Dar de baja' : 'Reactivar'}
                              onClick={() => {
                                cambiarEstado.reset();
                                if (usuario.activo) setADarDeBaja(usuario.id);
                                else cambiar(usuario, true);
                              }}
                            >
                              {usuario.activo ? <Ban /> : <ArchiveRestore />}
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
