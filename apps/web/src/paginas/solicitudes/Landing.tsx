import { ArrowRight, Car, Check, ChefHat, MapPin, Receipt, Share2, Users } from 'lucide-react';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { FOTOS } from '@/lib/fotos';
import { SalonesPublicos } from '@/paginas/salones/SalonesPublicos';
import { ServiciosPublicos } from '@/paginas/servicios/ServiciosPublicos';
import {
  CONDICIONES_DE_CONTRATACION,
  FORMATOS_DE_ARMADO,
  INCLUIDO_SIN_CARGO,
  INSTAGRAM,
  UBICACION,
} from './datos-institucionales';

const NUMERALES = ['I', 'II', 'III', 'IV', 'V'];

// Encabezado de sección con el filete dorado del tarifario.
function TituloSeccion({
  antetitulo,
  titulo,
  bajada,
  claro = false,
}: {
  antetitulo: string;
  titulo: string;
  bajada?: string;
  claro?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-[0.3em] text-dorado uppercase">{antetitulo}</p>
      <h2
        className={`mt-3 text-3xl font-semibold sm:text-4xl ${claro ? 'text-crema' : 'text-bordo'}`}
      >
        {titulo}
      </h2>
      <div className="mx-auto mt-5 flex items-center justify-center gap-3" aria-hidden>
        <span className="h-px w-12 bg-dorado/60" />
        <span className="size-1.5 rotate-45 bg-dorado" />
        <span className="h-px w-12 bg-dorado/60" />
      </div>
      {bajada && (
        <p
          className={`mt-5 font-display text-xl italic ${claro ? 'text-crema/75' : 'text-muted-foreground'}`}
        >
          {bajada}
        </p>
      )}
    </div>
  );
}

// Landing pública (HU-07, sobre la carta de presentación de HU-14): presenta salones, oferta
// gastronómica, ubicación, redes, formatos de armado y condiciones de contratación. No requiere
// autenticación (criterio 1 de HU-07 y criterio 2 de HU-14).
//
// Salones y servicios se leen de la API (criterio 4: los cambios se reflejan sin publicación
// manual). Lo institucional es estático, en datos-institucionales.ts.
//
// Sin precios en toda la pantalla: los ve el cliente registrado en el cotizador. "Cotizá tu
// evento" (y "Cotizar en este salón", criterio 3 de HU-07) piden iniciar sesión o crear la cuenta
// y abren el cotizador. Desde la entrevista del 24/09/2026 no hay consulta sin cuenta: toda
// consulta del canal público pasa por el registro (dominio.md, "Canal público").
export function Landing({
  onCotizar,
  onAccesoPersonal,
}: {
  onCotizar: (salonId?: number) => void;
  onAccesoPersonal: () => void;
}) {
  return (
    <main className="fondo-papel text-foreground">
      {/* Portada */}
      <section className="relative isolate flex min-h-[88vh] items-end overflow-hidden">
        <img
          src={FOTOS.auditorio}
          alt="Auditorio del Hotel Dr. César Carman armado en formato conferencia"
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bordo-oscuro/95 via-bordo-oscuro/70 to-bordo-oscuro/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="mx-auto w-full max-w-6xl px-4 pt-28 pb-10 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.3em] text-dorado uppercase">
              Hotel Dr. César Carman · Córdoba
            </p>
            <h1 className="mt-5 text-4xl leading-[1.1] font-semibold text-crema sm:text-6xl">
              Tu evento, en el salón que se ajusta a vos
            </h1>
            <p className="mt-6 font-display text-2xl text-crema/85 italic">
              Cinco salones, gastronomía propia y un equipo que se ocupa de cada detalle.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-dorado px-7 text-sm tracking-wide text-bordo-oscuro hover:bg-dorado/90"
                onClick={() => onCotizar()}
              >
                Consultá para hacer tu evento <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-crema/40 bg-transparent px-7 text-sm text-crema hover:bg-crema/10 hover:text-crema"
                asChild
              >
                <a href="#salones">Conocé los salones</a>
              </Button>
            </div>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-crema/15 ring-1 ring-crema/15 backdrop-blur-md md:grid-cols-4">
            {[
              { icono: Users, valor: 'Hasta 280', detalle: 'personas en el Auditorio' },
              { icono: Receipt, valor: '5 salones', detalle: 'de 24 a 289 m²' },
              { icono: ChefHat, valor: 'Gastronomía', detalle: 'propia, del coffee a la cena' },
              { icono: Car, valor: '100 autos', detalle: 'estacionamiento sin cargo' },
            ].map(({ icono: Icono, valor, detalle }) => (
              <div key={valor} className="bg-bordo-oscuro/40 px-5 py-4 text-crema">
                <Icono className="size-4 text-dorado" />
                <dt className="mt-2 font-serif text-lg font-semibold">{valor}</dt>
                <dd className="text-xs text-crema/70">{detalle}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Presentación */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-dorado uppercase">
            Los Abuelos Servicios Gastronómicos SRL
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-bordo sm:text-4xl">
            Eventos sociales y empresariales con sello propio
          </h2>
          <p className="mt-6 leading-relaxed text-muted-foreground">
            Congresos, capacitaciones, lanzamientos, almuerzos de trabajo y celebraciones. Te
            acompañamos desde la primera consulta hasta el último café: elegís el salón, el armado y
            la propuesta gastronómica, y nosotros nos ocupamos del resto.
          </p>
          <p className="mt-6 font-display text-xl text-bordo italic">
            “Le agradecemos que se haya contactado con nosotros.”
          </p>
          <Button size="lg" className="mt-8 h-11 px-6" onClick={() => onCotizar()}>
            Armá tu presupuesto online <ArrowRight />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <img
            src={FOTOS.mozo}
            alt="Mozo sirviendo empanadas"
            className="h-80 w-full rounded-2xl object-cover shadow-lg"
          />
          <div className="flex flex-col gap-4 pt-10">
            <img
              src={FOTOS.emplatado}
              alt="Emplatado de un almuerzo"
              className="h-56 w-full rounded-2xl object-cover shadow-lg"
            />
            <img
              src={FOTOS.evento}
              alt="Salón armado en formato banquete durante un evento"
              className="h-40 w-full rounded-2xl object-cover shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* Salones (HU-07) */}
      <section id="salones" className="scroll-mt-20 border-t border-border/60 bg-papel/60 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <TituloSeccion
            antetitulo="Nuestros salones"
            titulo="Un espacio para cada evento"
            bajada="Mirá las distribuciones de cada salón y cotizá por el que te sirva."
          />
          <SalonesPublicos onConsultar={(salon) => onCotizar(salon.id)} />
        </div>
      </section>

      {/* Gastronomía */}
      <section id="gastronomia" className="scroll-mt-20 bg-bordo-oscuro py-24 text-crema">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <TituloSeccion
            antetitulo="Servicios gastronómicos"
            titulo="Nuestra carta para eventos"
            bajada="Se suman al evento según la cantidad de personas que definas."
            claro
          />
          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { src: FOTOS.desayuno, alt: 'Mesa de desayuno con medialunas y frutas' },
              { src: FOTOS.almuerzo, alt: 'Cazuelas y copas en una mesa de almuerzo' },
              { src: FOTOS.emplatado, alt: 'Platos de almuerzo emplatados' },
              { src: FOTOS.mesaVinos, alt: 'Mesa de cena con vinos' },
            ].map((foto) => (
              <img
                key={foto.src}
                src={foto.src}
                alt={foto.alt}
                className="h-44 w-full rounded-xl object-cover opacity-90 ring-1 ring-crema/10 md:h-56"
              />
            ))}
          </div>
          <ServiciosPublicos />
        </div>
      </section>

      {/* Formatos de armado e incluido sin cargo */}
      <section id="armado" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <TituloSeccion
          antetitulo="Armado y servicios"
          titulo="Cada salón, a la medida de tu evento"
          bajada="Elegí el formato de armado; lo que ves abajo viene incluido con el salón."
        />
        <ol className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {FORMATOS_DE_ARMADO.map((formato, indice) => (
            <li
              key={formato}
              className="rounded-xl bg-card p-6 text-center shadow-sm ring-1 ring-border"
            >
              <span className="font-serif text-2xl text-dorado">{NUMERALES[indice]}</span>
              <p className="mt-2 font-medium text-bordo">{formato}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 rounded-2xl bg-card p-8 shadow-sm ring-1 ring-border">
          <h3 className="text-xl font-semibold text-bordo">Incluido sin cargo</h3>
          <ul className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {INCLUIDO_SIN_CARGO.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-dorado" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Condiciones de contratación */}
      <section
        id="condiciones"
        className="scroll-mt-20 border-y border-border/60 bg-papel/60 py-24"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <TituloSeccion
            antetitulo="Condiciones de contratación"
            titulo="Todo claro desde el principio"
            bajada="Las mismas que figuran en el presupuesto que te enviamos."
          />
          <dl className="mt-12 grid gap-4 md:grid-cols-2">
            {CONDICIONES_DE_CONTRATACION.map(({ condicion, detalle }) => (
              <div
                key={condicion}
                className="flex gap-4 rounded-xl border-l-2 border-dorado bg-card px-5 py-4 shadow-sm"
              >
                <div>
                  <dt className="text-sm font-semibold text-bordo">{condicion}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{detalle}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Llamado final: la consulta siempre pasa por la cuenta del cliente */}
      <section id="contacto" className="relative isolate scroll-mt-20 overflow-hidden py-24">
        <img
          src={FOTOS.mesaVinos}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-bordo-oscuro/85" />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center text-crema sm:px-6">
          <p className="text-xs font-semibold tracking-[0.3em] text-dorado uppercase">
            Hagamos tu evento
          </p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-5xl">Tu presupuesto, en minutos</h2>
          <p className="mt-6 font-display text-xl text-crema/80 italic">
            Iniciá sesión o creá tu cuenta con tu nombre, email, teléfono y una contraseña, y armá
            tu presupuesto estimado con los precios vigentes.
          </p>
          <ul className="mt-8 grid gap-3 text-left text-sm text-crema/85 sm:grid-cols-2">
            {[
              'Elegís fecha, cantidad de personas y salón',
              'Sumás la gastronomía que quieras',
              'Ves al instante el subtotal, el IVA y el total',
              'Tu presupuesto tiene una validez de 10 días',
            ].map((paso) => (
              <li key={paso} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-dorado" /> {paso}
              </li>
            ))}
          </ul>
          <Button
            size="lg"
            className="mt-10 h-12 bg-dorado px-7 text-sm text-bordo-oscuro hover:bg-dorado/90"
            onClick={() => onCotizar()}
          >
            Iniciá sesión para cotizar tu evento <ArrowRight />
          </Button>
          <p className="mt-3 text-xs text-crema/60">
            Los precios solo se muestran a clientes registrados.
          </p>
        </div>
      </section>

      <footer className="bg-bordo-oscuro text-crema/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Logo claro />
          <div className="flex flex-col gap-3 text-sm">
            <a
              href={UBICACION.mapaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-crema"
            >
              <MapPin className="size-4 text-dorado" />
              Hotel Dr. César Carman · {UBICACION.direccion} · {UBICACION.localidad}
            </a>
            <a
              href={INSTAGRAM.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 hover:text-crema"
            >
              <Share2 className="size-4 text-dorado" />
              {INSTAGRAM.usuario} en Instagram
            </a>
          </div>
        </div>
        <div className="border-t border-crema/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-crema/50 sm:px-6">
            <span>© 2026 Los Abuelos Servicios Gastronómicos SRL</span>
            <button type="button" className="hover:text-crema" onClick={onAccesoPersonal}>
              Acceso personal
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
