import bcrypt from 'bcrypt';

// Costo de bcrypt: 10 es el default de la librería y el balance estándar entre
// seguridad (cuánto tarda un ataque de fuerza bruta) y latencia aceptable en un
// login interactivo. No se sube porque no hay un requisito de docs/ que lo pida.
const COSTO_HASH = 10;

// RN de HU-27, criterio 4: las contraseñas nunca se guardan en texto plano.
export async function hashearContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, COSTO_HASH);
}

export async function compararContrasena(contrasena: string, hash: string): Promise<boolean> {
  return bcrypt.compare(contrasena, hash);
}
