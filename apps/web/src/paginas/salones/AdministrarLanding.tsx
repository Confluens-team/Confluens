import type { DestinoFoto } from '@confluens/shared';
import { ImageOff, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TAMANO_MAXIMO_FOTO, useSubirFoto } from '@/hooks/use-fotos';
import { useActualizarLandingSalon, useSalones } from '@/hooks/use-salones';
import { useActualizarLandingServicio, useServicios } from '@/hooks/use-servicios';
import { ErrorApiCliente } from '@/lib/api';

function mensajeDeError(error: unknown, alternativa: string): string {
  return error instanceof ErrorApiCliente || error instanceof Error ? error.message : alternativa;
}

// Editor de la foto, igual para salones y para servicios. Se elige el archivo de la galería (en el
// celular abre la galería o la cámara), se sube directo a Cloudinary y se guarda la URL que
// devuelve, todo de una: no hay un paso "Guardar" aparte, así no quedan fotos subidas sin usar
// (ADR 0009). La foto anterior la borra la API al guardar la nueva o al quitarla.
function EditorDeFoto({
  idCampo,
  destino,
  fotoUrl,
  guardando,
  onGuardar,
}: {
  idCampo: string;
  destino: DestinoFoto;
  fotoUrl: string | null;
  guardando: boolean;
  onGuardar: (fotoUrl: string | null) => void;
}) {
  const subir = useSubirFoto();
  const entrada = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagenRota, setImagenRota] = useState(false);
  const ocupado = subir.isPending || guardando;

  function elegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    // Se limpia para que volver a elegir el mismo archivo dispare el cambio otra vez.
    evento.target.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      setError('Elegí un archivo de imagen (JPG, PNG, WebP…).');
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_FOTO) {
      setError('La foto pesa más de 10 MB. Elegí una más liviana.');
      return;
    }
    setError(null);
    subir.mutate(
      { archivo, destino },
      {
        onSuccess: (url) => {
          setImagenRota(false);
          onGuardar(url);
        },
        onError: (falla) => setError(mensajeDeError(falla, 'No se pudo subir la foto.')),
      },
    );
  }

  return (
    <div className="flex items-center gap-3">
      {fotoUrl && !imagenRota ? (
        <img
          src={fotoUrl}
          alt=""
          className="size-20 shrink-0 rounded-md object-cover"
          onError={() => setImagenRota(true)}
        />
      ) : (
        <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-muted">
          <ImageOff className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 space-y-1.5">
        <input
          ref={entrada}
          id={idCampo}
          type="file"
          accept="image/*"
          hidden
          onChange={elegirArchivo}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={ocupado}
            onClick={() => entrada.current?.click()}
          >
            <ImagePlus />
            {subir.isPending
              ? 'Subiendo…'
              : guardando
                ? 'Guardando…'
                : fotoUrl
                  ? 'Cambiar foto'
                  : 'Elegir foto'}
          </Button>
          {fotoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={ocupado}
              onClick={() => {
                setError(null);
                onGuardar(null);
              }}
            >
              <Trash2 /> Quitar foto
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && imagenRota && (
          <p className="text-sm text-muted-foreground">La foto guardada no se pudo cargar.</p>
        )}
        {!error && !imagenRota && (
          <p className="text-xs text-muted-foreground">JPG, PNG o WebP de hasta 10 MB.</p>
        )}
      </div>
    </div>
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
          Elegí qué salones se publican y subí desde tu galería las fotos que se muestran en el
          sitio público (HU-08). Los cambios se ven en la landing al instante, sin ningún paso de
          publicación adicional.
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
                  destino="salones"
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
                destino="servicios"
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
