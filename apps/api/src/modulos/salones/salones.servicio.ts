import type { ActualizarLandingSalon, CrearDistribucion, ModificarSalon } from '@confluens/shared';

import { borrarFotoReemplazada } from '../../lib/cloudinary.js';
import { ErrorApi } from '../../lib/errores.js';
import {
  actualizarLanding,
  buscarDistribucionPorNombre,
  crearDistribucion,
  modificarSalon,
  obtenerSalonesConDistribuciones,
  obtenerSalonesPublicos,
  obtenerSalonPorId,
} from './salones.repositorio.js';

// Repositorio con default (inyección de dependencias) para poder testear con un repo fake sin
// tocar la base — mismo criterio que auth.servicio.ts (HU-27).
//
// Sin lógica de negocio acá a propósito: HU-01 es una consulta de catálogo sin reglas RN-xx (el
// filtro por capacidad mínima y la sugerencia del salón más grande cuando ninguno alcanza son
// puramente de presentación, se resuelven en la web sobre la lista completa que ya se trajo).
// AGENTS.md §5 no pide test de servicio para "CRUD simple sin reglas"; el formato y status del
// endpoint se cubren en salones.rutas.test.ts.
export async function listarSalones(repo = { obtenerSalonesConDistribuciones }) {
  return repo.obtenerSalonesConDistribuciones();
}

// Listado del canal público (HU-07). El filtro de visibilidad y el recorte de campos viven en el
// repositorio, no acá: son parte de la consulta, no de una regla que dependa de quién pregunta.
export async function listarSalonesPublicos(repo = { obtenerSalonesPublicos }) {
  return repo.obtenerSalonesPublicos();
}

// HU-08: publicar/despublicar un salón y asignarle la foto de la landing. Acá sí hay lógica más
// allá del CRUD, y es la que justifica el test de servicio: se lee el estado anterior para poder
// auditarlo, y se corta con 404 antes de escribir si el salón no existe. Si la foto cambió, la
// anterior se borra de Cloudinary después de guardar (ADR 0009).
export async function actualizarLandingSalon(
  id: number,
  cambios: ActualizarLandingSalon,
  usuarioId: number,
  repo = { obtenerSalonPorId, actualizarLanding },
  fotos = { borrarFotoReemplazada },
) {
  const salon = await repo.obtenerSalonPorId(id);
  if (!salon) throw ErrorApi.noEncontrado('No existe el salón indicado');

  const anterior = { visibleEnLanding: salon.visibleEnLanding, fotoUrl: salon.fotoUrl };
  const actualizado = await repo.actualizarLanding(id, cambios, anterior, usuarioId);
  await fotos.borrarFotoReemplazada(anterior.fotoUrl, cambios.fotoUrl);
  return actualizado;
}

// HU-25: alta de una distribución en un salón. Las tres reglas dependen de lo que ya está en la
// base, por eso viven acá y no en el schema: el salón tiene que existir (404), el nombre no puede
// repetirse en el salón sin distinguir mayúsculas (409) y la capacidad no puede superar la del
// salón (422, dominio.md). Se corta antes de escribir para que ninguna deje una fila a medias.
export async function registrarDistribucion(
  salonId: number,
  datos: CrearDistribucion,
  repo = { obtenerSalonPorId, buscarDistribucionPorNombre, crearDistribucion },
) {
  const salon = await repo.obtenerSalonPorId(salonId);
  if (!salon) throw ErrorApi.noEncontrado('No existe el salón indicado');

  const existente = await repo.buscarDistribucionPorNombre(salonId, datos.nombre);
  if (existente) {
    throw ErrorApi.conflicto(
      `${salon.nombre} ya tiene una distribución llamada «${existente.nombre}»`,
    );
  }

  if (datos.capacidad > salon.capacidadMaxima) {
    throw ErrorApi.reglaNegocio(
      `La capacidad no puede superar la del salón (${salon.capacidadMaxima} personas)`,
      [{ campo: 'capacidad', mensaje: `Máximo ${salon.capacidadMaxima} personas` }],
    );
  }

  return repo.crearDistribucion(salonId, datos);
}

// HU-26 (Sprint 4): 404 si el salón no existe, antes de escribir. Las reglas de los datos están en
// el schema y el arrastre de las distribuciones, en el repositorio (va en la misma transacción).
export async function modificarDatosSalon(
  id: number,
  datos: ModificarSalon,
  repo = { obtenerSalonPorId, modificarSalon },
) {
  const salon = await repo.obtenerSalonPorId(id);
  if (!salon) throw ErrorApi.noEncontrado('No existe el salón indicado');
  return repo.modificarSalon(id, datos);
}
