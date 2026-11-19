import { prisma } from './prisma.js';

// Estado de conexión del personal: la última vez que cada usuario hizo algo en el panel. No hay una
// conexión permanente (la sesión es una cookie), así que «conectado» se deduce de esta marca.
//
// Se anota a lo sumo una vez por minuto por usuario: sin ese tope cada pedido sería una escritura en
// la base. Se frena en dos lugares: acá, en memoria, para ni siquiera ir a la base, y en el propio
// UPDATE, por si la API reinició o corren varias instancias.

const MINIMO_ENTRE_ESCRITURAS_MS = 60_000;

const ultimaEscritura = new Map<number, number>();

// Directo a SQL y no con prisma.usuario.update: así no toca `actualizadoEn` (@updatedAt), que dice
// cuándo se modificó al usuario, y no pasa por la auditoría: anotar actividad no es un cambio.
async function escribirActividad(usuarioId: number): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Usuario"
    SET "ultimaActividad" = now()
    WHERE "id" = ${usuarioId}
      AND ("ultimaActividad" IS NULL OR "ultimaActividad" < now() - interval '60 seconds')
  `;
}

/**
 * Anota que el usuario hizo algo recién. No espera a la base ni falla: si la escritura sale mal solo
 * se pierde una luz, no el pedido del usuario.
 */
export function anotarActividad(
  usuarioId: number,
  ahora: number = Date.now(),
  escribir: (usuarioId: number) => Promise<void> = escribirActividad,
): void {
  const anterior = ultimaEscritura.get(usuarioId);
  if (anterior !== undefined && ahora - anterior < MINIMO_ENTRE_ESCRITURAS_MS) return;
  ultimaEscritura.set(usuarioId, ahora);
  escribir(usuarioId).catch((error: unknown) => {
    // Que el próximo pedido pueda volver a intentarlo.
    ultimaEscritura.delete(usuarioId);
    console.error('No se pudo anotar la actividad del usuario', usuarioId, error);
  });
}

/** Al cerrar sesión: la marca se borró en la base y el próximo pedido tiene que poder anotar. */
export function olvidarActividad(usuarioId: number): void {
  ultimaEscritura.delete(usuarioId);
}
