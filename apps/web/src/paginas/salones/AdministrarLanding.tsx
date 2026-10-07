import { esquemaActualizarLandingServicio } from '@confluens/shared';
import { ImageOff } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActualizarLandingSalon, useSalones } from '@/hooks/use-salones';
import { useActualizarLandingServicio, useServicios } from '@/hooks/use-servicios';
import { ErrorApiCliente } from '@/lib/api';

function mensajeDeError(error: unknown, alternativa: string): string {
  return error instanceof ErrorApiCliente ? error.message : alternativa;
}

// Editor de la URL de la foto, igual para salones y para servicios: en los dos casos el campo es
// el mismo `fotoUrl` con la misma validación, así que se comparte en vez de duplicarlo.
// Dejar el campo vacío y guardar manda `null`, que es la forma de quitar la foto.
function EditorDeFoto({
  idCampo,
  fotoUrl,
  guardando,
  onGuardar,
}: {
  idCampo: string;
  fotoUrl: string | null;
  guardando: boolean;
  onGuardar: (fotoUrl: string | null) => void;
}) {
  const [valor, setValor] = useState(fotoUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [imagenRota, setImagenRota] = useState(false);

  const recortado = valor.trim();
  // La previsualización usa el valor tipeado, no el guardado: la idea es ver la foto antes de
  // publicarla, no después. Se muestra solo si ya es una URL válida para no pedirle al navegador
  // una imagen por cada tecla.
  const previsualizable = esquemaActualizarLandingServicio.safeParse({
    fotoUrl: recortado,
  }).success;

  function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();

    if (recortado === '') {
      setError(null);
      onGuardar(null);
      return;
    }

    // Mismo schema que valida el servidor (packages/shared): si no pasa acá tampoco pasaría la
    // API, así que se evita el round-trip (mismo criterio que RegistrarServicio.tsx).
    const resultado = esquemaActualizarLandingServicio.safeParse({ fotoUrl: recortado });
    if (!resultado.success) {
      setError(resultado.error.issues[0]?.message ?? 'Ingresá una URL válida');
      return;
    }

    setError(null);
    onGuardar(recortado);
  }

  return (
    <form onSubmit={manejarEnvio} className="space-y-1.5">
      <Label htmlFor={idCampo} className="text-xs text-muted-foreground">
        URL de la foto (vacío quita la foto)
      </Label>
      <div className="flex items-start gap-2">
        {previsualizable && !imagenRota ? (
          <img
            src={recortado}
            alt=""
            className="size-12 shrink-0 rounded-md object-cover"
            onError={() => setImagenRota(true)}
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
            <ImageOff className="size-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 space-y-1.5">
          <Input
            id={idCampo}
            value={valor}
            placeholder="https://…"
            onChange={(e) => {
              setValor(e.target.value);
              setImagenRota(false);
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && imagenRota && (
            <p className="text-sm text-muted-foreground">
              La URL es válida pero la imagen no se pudo cargar.
            </p>
          )}
        </div>
        <Button type="submit" variant="outline" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}

// HU-08: el Administrador del Sistema decide qué salones se publican y qué fotos se muestran en la
// landing. Lee de GET /salones (el interno, que devuelve también los despublicados) porque acá hay
// que poder volver a publicar un salón que hoy no se ve en el canal público.
//
// No hay un paso de publicación aparte: cada cambio impacta en la landing apenas responde el PATCH,
// porque los hooks invalidan ['salones'] / ['servicios'] y las claves públicas cuelgan de esas
// (criterio 3). El registro de quién cambió qué lo escribe la API en audit_log (criterio 4).
export function AdministrarLanding() {
  const { data: salones, isLoading: cargandoSalones, isError: errorSalones } = useSalones();
  const { data: servicios, isLoading: cargandoServicios, isError: errorServicios } = useServicios();

  const actualizarSalon = useActualizarLandingSalon();
  const actualizarServicio = useActualizarLandingServicio();

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Landing page</h1>
        <p className="text-sm text-muted-foreground">
          Elegí qué salones se publican y cargá las fotos que se muestran en el sitio público
          (HU-08). Los cambios se ven en la landing al instante, sin ningún paso de publicación
          adicional.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Salones</h2>

        {cargandoSalones && <p className="text-sm text-muted-foreground">Cargando salones…</p>}
        {errorSalones && (
          <p className="text-sm text-destructive">No se pudieron cargar los salones.</p>
        )}
        {actualizarSalon.isError && (
          <p className="text-sm text-destructive">
            {mensajeDeError(actualizarSalon.error, 'No se pudo actualizar el salón.')}
          </p>
        )}

        <ul className="divide-y rounded-lg border">
          {salones?.map((salon) => {
            // variables son las del PATCH en vuelo: así el "Guardando…" aparece solo en la fila
            // que se está tocando y no en las cinco a la vez.
            const guardando =
              actualizarSalon.isPending && actualizarSalon.variables?.id === salon.id;

            return (
              <li key={salon.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">{salon.nombre}</p>
                  {/* Checkbox y no un switch: components/ui no tiene Switch generado y no vale la
                      pena sumar una dependencia de shadcn por un solo control. */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`visible-${salon.id}`}
                      checked={salon.visibleEnLanding}
                      disabled={guardando}
                      onCheckedChange={(marcado) =>
                        actualizarSalon.mutate({
                          id: salon.id,
                          cambios: { visibleEnLanding: marcado === true },
                        })
                      }
                    />
                    <Label htmlFor={`visible-${salon.id}`} className="text-sm">
                      Visible en la landing
                    </Label>
                  </div>
                </div>

                <EditorDeFoto
                  idCampo={`foto-salon-${salon.id}`}
                  fotoUrl={salon.fotoUrl}
                  guardando={guardando}
                  onGuardar={(fotoUrl) =>
                    actualizarSalon.mutate({ id: salon.id, cambios: { fotoUrl } })
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Servicios</h2>
        <p className="text-sm text-muted-foreground">
          Los servicios del catálogo se publican todos mientras estén activos; acá solo se les carga
          la foto.
        </p>

        {cargandoServicios && <p className="text-sm text-muted-foreground">Cargando servicios…</p>}
        {errorServicios && (
          <p className="text-sm text-destructive">No se pudieron cargar los servicios.</p>
        )}
        {actualizarServicio.isError && (
          <p className="text-sm text-destructive">
            {mensajeDeError(actualizarServicio.error, 'No se pudo actualizar el servicio.')}
          </p>
        )}

        <ul className="divide-y rounded-lg border">
          {servicios?.map((servicio) => (
            <li key={servicio.id} className="space-y-3 p-4">
              <div>
                <p className="font-medium">{servicio.nombre}</p>
                <p className="text-sm text-muted-foreground">
                  {servicio.categoria ?? 'Sin categoría'}
                </p>
              </div>

              <EditorDeFoto
                idCampo={`foto-servicio-${servicio.id}`}
                fotoUrl={servicio.fotoUrl}
                guardando={
                  actualizarServicio.isPending && actualizarServicio.variables?.id === servicio.id
                }
                onGuardar={(fotoUrl) => actualizarServicio.mutate({ id: servicio.id, fotoUrl })}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
