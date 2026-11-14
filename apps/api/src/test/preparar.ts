import { vi } from 'vitest';

// autenticar.ts contrasta cada sesión con la base (M2 de la auditoría, lib/sesion-vigente.ts).
// Los tests de rutas corren sin Postgres y firman su cookie con firmarToken() a mano, así que acá
// se reemplaza ese contraste por "la sesión del token sigue vigente". La lógica real se prueba en
// lib/sesion-vigente.test.ts con vi.importActual.
vi.mock('../lib/sesion-vigente.js', () => ({
  sesionVigente: vi.fn(async (sesion: unknown) => sesion),
}));

// autenticar.ts anota la actividad del personal en la base (lib/actividad.ts). Los tests de rutas
// corren sin Postgres, así que acá no se anota nada. La lógica real se prueba en lib/actividad.test.ts.
vi.mock('../lib/actividad.js', () => ({
  anotarActividad: vi.fn(),
  olvidarActividad: vi.fn(),
}));
