import type { DestinoFoto } from '@confluens/shared';
import { ImageOff, ImagePlus, Maximize2, Trash2, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TAMANO_MAXIMO_FOTO, useSubirFoto } from '@/hooks/use-fotos';
import { useActualizarLandingSalon, useSalones } from '@/hooks/use-salones';
import { useActualizarLandingServicio, useServicios } from '@/hooks/use-servicios';
import { ErrorApiCliente } from '@/lib/api';
import { fotoDeSalon, fotoOptimizada } from '@/lib/fotos';

function mensajeDeError(error: unknown, alternativa: string): string {
  return error instanceof ErrorApiCliente || error instanceof Error ? error.message : alternativa;
}

// Editor de la foto, igual para salones y para servicios. Se elige el archivo de la galería (en el
// celular abre la galería o la cámara), se sube directo a Cloudinary y se guarda la URL que
// devuelve, todo de una: no hay un paso "Guardar" aparte, así no quedan fotos subidas sin usar
// (ADR 0009). La foto anterior la borra la API al guardar la nueva o al quitarla.
function EditorDeFoto({
  idCampo,
  nombre,
  destino,
  fotoUrl,
  fotoDeRespaldo,
  guardando,
  onGuardar,
}: {
  idCampo: string;
  // Del salón o del servicio: titula la vista previa.
  nombre: string;
  destino: DestinoFoto;
  fotoUrl: string | null;
  // Lo que la landing muestra mientras no haya foto propia (los salones tienen una de ambiente).
  fotoDeRespaldo?: string;
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
      {(fotoUrl || fotoDeRespaldo) && !imagenRota ? (
        // La miniatura abre la foto en grande: a 80 px no se llega a ver cómo quedó.
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label={`Ver la foto de ${nombre} en grande`}
              title="Ver en grande"
              className="group relative size-20 shrink-0 overflow-hidden rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <img
                src={fotoUrl ? fotoOptimizada(fotoUrl, 200) : fotoDeRespaldo}
                alt=""
                className="size-full object-cover transition-transform group-hover:scale-105"
                onError={() => setImagenRota(true)}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-bordo-oscuro/40 text-crema opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Maximize2 className="size-5" />
              </span>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-bordo-oscuro/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-papel p-4 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <Dialog.Title className="font-heading text-lg font-medium">{nombre}</Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    {fotoUrl
                      ? 'La foto que se muestra en la landing.'
                      : 'Foto de ejemplo: es la que se ve en la landing hasta que subas una propia.'}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Cerrar">
                    <X />
                  </Button>
                </Dialog.Close>
              </div>
              {/* 1600 px reales: el diálogo llega a 56rem de ancho y en pantallas de alta
                  densidad se ve nítida. La foto entera, sin recortar. */}
              <img
                src={fotoUrl ? fotoOptimizada(fotoUrl, 1600) : fotoDeRespaldo}
                alt={`Foto de ${nombre}`}
                className="max-h-[75vh] w-full rounded-lg bg-muted object-contain"
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
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
          <p className="text-xs text-muted-foreground">
            {fotoUrl || !fotoDeRespaldo
              ? 'JPG, PNG o WebP de hasta 10 MB.'
              : 'Foto de ejemplo: es la que se ve en la landing hasta que subas una propia. JPG, PNG o WebP de hasta 10 MB.'}
          </p>
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
// puedePublicar (HU-56): solo el ADM decide qué salones se publican. El GG ve la casilla, pero no la
// puede cambiar, y sí cambia las fotos.
export function AdministrarLanding({ puedePublicar }: { puedePublicar: boolean }) {
  const { data: salones, isLoading: cargandoSalones, isError: errorSalones } = useSalones();
  const { data: servicios, isLoading: cargandoServicios, isError: errorServicios } = useServicios();

  const actualizarSalon = useActualizarLandingSalon();
  const actualizarServicio = useActualizarLandingServicio();

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Landing page</h1>
        <p className="text-sm text-muted-foreground">
          {puedePublicar
            ? 'Elegí qué salones se publican y subí desde tu galería las fotos que se muestran en el sitio público. '
            : 'Subí desde tu galería las fotos que se muestran en el sitio público. Qué salones se publican lo decide el Administrador del Sistema. '}
          Los cambios se ven en la landing al instante, sin ningún paso de publicación adicional.
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
                      disabled={guardando || !puedePublicar}
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
                  nombre={salon.nombre}
                  destino="salones"
                  fotoUrl={salon.fotoUrl}
                  fotoDeRespaldo={fotoDeSalon(salon, 200)}
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
                nombre={servicio.nombre}
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
