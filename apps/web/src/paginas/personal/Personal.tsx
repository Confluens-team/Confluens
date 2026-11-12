import {
  esquemaCambiarContrasenaUsuario,
  esquemaModificarUsuario,
  esquemaRegistrarUsuario,
  rolesQueAsigna,
  type RolPersonal,
  type Sesion,
  type Usuario,
} from '@confluens/shared';
import { CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VentanaFormulario } from '@/components/VentanaFormulario';
import {
  useCambiarContrasenaUsuario,
  useModificarUsuario,
  useRegistrarUsuario,
} from '@/hooks/use-usuarios';
import { ErrorApiCliente } from '@/lib/api';
import { NOMBRES_DE_ROL } from '@/lib/roles';
import { CLASES_SELECT } from '@/paginas/eventos/clases-select';

import { ListadoPersonal } from './ListadoPersonal';

// HU-30 del Sprint 4: alta de un usuario del personal. El rol se elige entre los que puede asignar
// quien tiene la sesión (el GG no ve Administrador del Sistema; la API igual lo rechaza con 403) y
// la contraseña inicial la define quien da el alta (PO, 06/11/2026). Mismo patrón que
// RegistrarMedioPago: estado controlado y validación con el schema de shared antes de enviar.
function FormularioUsuario({
  roles,
  onGuardado,
}: {
  roles: readonly RolPersonal[];
  onGuardado: (email: string) => void;
}) {
  const registrar = useRegistrarUsuario();
  const [valores, setValores] = useState({ email: '', rol: '', contrasena: '' });
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});

  function actualizarCampo(campo: keyof typeof valores, valor: string) {
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
  }

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    const resultado = esquemaRegistrarUsuario.safeParse(valores);
    if (!resultado.success) {
      const errores: Record<string, string> = {};
      for (const issue of resultado.error.issues) errores[String(issue.path[0])] = issue.message;
      setErroresCampos(errores);
      return;
    }
    setErroresCampos({});
    registrar.mutate(resultado.data, { onSuccess: (usuario) => onGuardado(usuario.email) });
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="usuario-email">Correo</Label>
        <Input
          id="usuario-email"
          type="email"
          autoComplete="off"
          placeholder="nombre@empresa.com"
          value={valores.email}
          aria-invalid={!!erroresCampos['email']}
          onChange={(e) => actualizarCampo('email', e.target.value)}
        />
        {erroresCampos['email'] && (
          <p className="text-sm text-destructive">{erroresCampos['email']}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="usuario-rol">Rol</Label>
        <select
          id="usuario-rol"
          className={CLASES_SELECT}
          value={valores.rol}
          aria-invalid={!!erroresCampos['rol']}
          onChange={(e) => actualizarCampo('rol', e.target.value)}
        >
          <option value="" disabled>
            Elegí un rol
          </option>
          {roles.map((rol) => (
            <option key={rol} value={rol}>
              {NOMBRES_DE_ROL[rol]}
            </option>
          ))}
        </select>
        {erroresCampos['rol'] && <p className="text-sm text-destructive">{erroresCampos['rol']}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="usuario-contrasena">Contraseña inicial</Label>
        <Input
          id="usuario-contrasena"
          type="password"
          autoComplete="new-password"
          value={valores.contrasena}
          aria-invalid={!!erroresCampos['contrasena']}
          onChange={(e) => actualizarCampo('contrasena', e.target.value)}
        />
        {erroresCampos['contrasena'] ? (
          <p className="text-sm text-destructive">{erroresCampos['contrasena']}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Al menos 8 caracteres, y no una contraseña común como 12345678. Pasásela al usuario:
            entra con su correo y esta contraseña.
          </p>
        )}
      </div>

      {registrar.isError && (
        <p className="text-sm text-destructive">
          {registrar.error instanceof ErrorApiCliente
            ? registrar.error.message
            : 'No se pudo registrar el usuario.'}
        </p>
      )}
      <Button type="submit" disabled={registrar.isPending}>
        {registrar.isPending ? 'Guardando…' : 'Registrar usuario'}
      </Button>
    </form>
  );
}

// HU-30 del backlog: modificar el correo y el rol. El rol se elige entre los que puede asignar la
// sesión; el propio rol no se cambia desde acá (PO, 07/11/2026), así que en la propia fila queda fijo.
function FormularioModificarUsuario({
  usuario,
  roles,
  propio,
  onGuardado,
}: {
  usuario: Usuario;
  roles: readonly RolPersonal[];
  propio: boolean;
  onGuardado: (email: string) => void;
}) {
  const modificar = useModificarUsuario();
  const [valores, setValores] = useState({ email: usuario.email, rol: usuario.rol as string });
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});
  // El rol actual siempre está en el desplegable, aunque la sesión no lo pueda asignar.
  const rolActual = usuario.rol as RolPersonal;
  const opciones = roles.includes(rolActual) ? roles : [rolActual, ...roles];

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    const resultado = esquemaModificarUsuario.safeParse(valores);
    if (!resultado.success) {
      const errores: Record<string, string> = {};
      for (const issue of resultado.error.issues) errores[String(issue.path[0])] = issue.message;
      setErroresCampos(errores);
      return;
    }
    setErroresCampos({});
    modificar.mutate(
      { id: usuario.id, datos: resultado.data },
      { onSuccess: (guardado) => onGuardado(guardado.email) },
    );
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="modificar-email">Correo</Label>
        <Input
          id="modificar-email"
          type="email"
          autoComplete="off"
          value={valores.email}
          aria-invalid={!!erroresCampos['email']}
          onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
        />
        {erroresCampos['email'] && (
          <p className="text-sm text-destructive">{erroresCampos['email']}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="modificar-rol">Rol</Label>
        <select
          id="modificar-rol"
          className={CLASES_SELECT}
          value={valores.rol}
          disabled={propio}
          onChange={(e) => setValores((v) => ({ ...v, rol: e.target.value }))}
        >
          {opciones.map((rol) => (
            <option key={rol} value={rol}>
              {NOMBRES_DE_ROL[rol]}
            </option>
          ))}
        </select>
        {propio && (
          <p className="text-xs text-muted-foreground">
            Tu propio rol lo cambia otro Gerente General o un Administrador del Sistema.
          </p>
        )}
      </div>
      {modificar.isError && (
        <p className="text-sm text-destructive">
          {modificar.error instanceof ErrorApiCliente
            ? modificar.error.message
            : 'No se pudo modificar el usuario.'}
        </p>
      )}
      <Button type="submit" disabled={modificar.isPending}>
        {modificar.isPending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  );
}

// HU-30 del backlog: el ADM le carga una contraseña nueva a otro usuario (PO, 06/11/2026). Sus
// sesiones abiertas se cierran.
function FormularioContrasenaUsuario({
  usuario,
  onGuardado,
}: {
  usuario: Usuario;
  onGuardado: () => void;
}) {
  const cambiar = useCambiarContrasenaUsuario();
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    const resultado = esquemaCambiarContrasenaUsuario.safeParse({ contrasena });
    if (!resultado.success) {
      setError(resultado.error.issues[0]?.message ?? 'Contraseña inválida');
      return;
    }
    setError(null);
    cambiar.mutate({ id: usuario.id, contrasena }, { onSuccess: onGuardado });
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="contrasena-usuario">Contraseña nueva</Label>
        <Input
          id="contrasena-usuario"
          type="password"
          autoComplete="new-password"
          value={contrasena}
          aria-invalid={!!error}
          onChange={(e) => setContrasena(e.target.value)}
        />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Al menos 6 caracteres. Se cierran las sesiones abiertas de {usuario.email}.
          </p>
        )}
      </div>
      {cambiar.isError && (
        <p className="text-sm text-destructive">
          {cambiar.error instanceof ErrorApiCliente
            ? cambiar.error.message
            : 'No se pudo cambiar la contraseña.'}
        </p>
      )}
      <Button type="submit" disabled={cambiar.isPending}>
        {cambiar.isPending ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}

// HU-30 y HU-31 del Sprint 4: la sección Personal de Configuración de negocio, solo para el GG y el
// ADM (dominio.md, «Personal»). HU-30 y HU-31 del backlog (Sprint 5): modificar, dar de baja,
// reactivar y, el ADM, cambiar la contraseña de otro.
export function Personal({ sesion }: { sesion: Sesion }) {
  const rol = sesion.rol;
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enEdicion, setEnEdicion] = useState<Usuario | null>(null);
  const [conContrasenaNueva, setConContrasenaNueva] = useState<Usuario | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Personal</h1>
        <p className="text-sm text-muted-foreground">
          Los usuarios del panel interno y su rol. Cada uno entra con su propio correo y contraseña.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            setAviso(null);
            setAbierto(true);
          }}
        >
          <Plus /> Nuevo usuario
        </Button>
        {aviso && (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" /> {aviso}
          </p>
        )}
      </div>

      <VentanaFormulario
        abierto={abierto}
        onCambiarAbierto={setAbierto}
        titulo="Nuevo usuario"
        descripcion="Cargá su correo, su rol y la contraseña con la que va a entrar."
      >
        {/* La key vacía el formulario cada vez que se abre la ventana. */}
        <FormularioUsuario
          key={String(abierto)}
          roles={rolesQueAsigna(rol)}
          onGuardado={(email) => {
            setAviso(`«${email}» quedó registrado y ya puede iniciar sesión.`);
            setAbierto(false);
          }}
        />
      </VentanaFormulario>

      <VentanaFormulario
        abierto={enEdicion !== null}
        onCambiarAbierto={(abiertoEdicion) => !abiertoEdicion && setEnEdicion(null)}
        titulo="Modificar usuario"
        descripcion="Cambiá su correo o su rol. El rol nuevo rige desde su próxima acción."
      >
        {enEdicion && (
          <FormularioModificarUsuario
            key={enEdicion.id}
            usuario={enEdicion}
            roles={rolesQueAsigna(rol)}
            propio={enEdicion.id === sesion.id}
            onGuardado={(email) => {
              setAviso(`«${email}» quedó modificado.`);
              setEnEdicion(null);
            }}
          />
        )}
      </VentanaFormulario>

      <VentanaFormulario
        abierto={conContrasenaNueva !== null}
        onCambiarAbierto={(abiertoClave) => !abiertoClave && setConContrasenaNueva(null)}
        titulo="Cambiar contraseña"
        descripcion={conContrasenaNueva ? `Contraseña nueva para ${conContrasenaNueva.email}.` : ''}
      >
        {conContrasenaNueva && (
          <FormularioContrasenaUsuario
            key={conContrasenaNueva.id}
            usuario={conContrasenaNueva}
            onGuardado={() => {
              setAviso(`La contraseña de «${conContrasenaNueva.email}» quedó cambiada.`);
              setConContrasenaNueva(null);
            }}
          />
        )}
      </VentanaFormulario>

      <ListadoPersonal
        sesion={sesion}
        onModificar={(usuario) => {
          setAviso(null);
          setEnEdicion(usuario);
        }}
        onCambiarContrasena={(usuario) => {
          setAviso(null);
          setConContrasenaNueva(usuario);
        }}
      />
    </div>
  );
}
