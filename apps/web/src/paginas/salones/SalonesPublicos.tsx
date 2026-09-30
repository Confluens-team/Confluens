import type { SalonPublico } from '@confluens/shared';
import { ArrowRight, Ruler, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSalonesPublicos } from '@/hooks/use-salones';
import { fotoDeSalon } from '@/lib/fotos';
import { cn } from '@/lib/utils';

// Listado de salones del canal público (HU-07). Lee de GET /salones/publicos, no de constantes en
// código: por eso un cambio de datos del salón se ve en la landing sin un paso de publicación
// manual (criterio 4) y un salón despublicado desde HU-08 deja de aparecer (criterio 6).
//
// Sin precios a propósito: el endpoint no los devuelve (ver salones.repositorio.ts). Los precios
// se ven recién en el cotizador, con la sesión del cliente registrado.
export function SalonesPublicos({ onConsultar }: { onConsultar: (salon: SalonPublico) => void }) {
  const { data: salones, isLoading, isError } = useSalonesPublicos();

  if (isLoading) {
    return (
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-96 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="mt-10 text-center text-sm text-destructive">
        No se pudieron cargar los salones. Probá recargar la página.
      </p>
    );
  }

  if (!salones || salones.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-muted-foreground">
        Por el momento no hay salones publicados. Escribinos y te contamos las opciones disponibles.
      </p>
    );
  }

  return (
    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {salones.map((salon, indice) => {
        // El primero (el de mayor capacidad: el endpoint ordena así) se destaca a doble ancho.
        const destacado = indice === 0 && salones.length > 3;

        return (
          <article
            key={salon.id}
            className={cn(
              'group flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border transition-shadow hover:shadow-xl',
              destacado && 'sm:col-span-2',
            )}
          >
            <div className={cn('relative overflow-hidden', destacado ? 'h-72' : 'h-56')}>
              <img
                src={fotoDeSalon(salon)}
                alt={`Salón ${salon.nombre}`}
                className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bordo-oscuro/85 via-bordo-oscuro/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-crema">
                <div>
                  <p className="text-[0.65rem] font-medium tracking-[0.25em] text-dorado uppercase">
                    Salón
                  </p>
                  <h3 className="text-3xl font-semibold">{salon.nombre}</h3>
                </div>
                <span className="rounded-full bg-crema/15 px-3 py-1 text-xs font-medium backdrop-blur">
                  Hasta {salon.capacidadMaxima} personas
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-5 p-5">
              <div className="flex gap-5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4 text-dorado" /> {salon.capacidadMaxima} personas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ruler className="size-4 text-dorado" /> {salon.superficie} m²
                </span>
              </div>

              {/* Criterio 2: las distribuciones posibles con la capacidad de cada una. */}
              {salon.distribuciones.length > 0 && (
                <div>
                  <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    Distribuciones
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {salon.distribuciones.map((distribucion) => (
                      <li key={distribucion.id} className="text-sm">
                        <div className="flex items-baseline justify-between">
                          <span>{distribucion.nombre}</span>
                          <span className="font-medium text-bordo">
                            {distribucion.capacidad} pers.
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-dorado to-bordo"
                            style={{
                              width: `${(distribucion.capacidad / salon.capacidadMaxima) * 100}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Criterio 3: desde la ficha se avanza a la consulta con el salón preseleccionado. */}
              <Button
                variant="outline"
                size="lg"
                className="mt-auto border-bordo/30 text-bordo hover:bg-bordo hover:text-crema"
                onClick={() => onConsultar(salon)}
              >
                Cotizar en este salón <ArrowRight />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
