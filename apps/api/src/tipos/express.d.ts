import type { Sesion } from '@confluens/shared';

// Augmentation del tipo Request de Express: autenticar.ts asigna req.usuario cuando
// el JWT es válido. Opcional (`?`) porque en rutas públicas (ej. POST /auth/login)
// nunca se setea. Vive en tipos/ y no en middlewares/autenticar.ts porque
// tsconfig.json incluye toda la carpeta src, así el compilador lo toma
// automáticamente sin necesidad de importarlo donde se usa `req.usuario`.
declare global {
  namespace Express {
    interface Request {
      usuario?: Sesion;
    }
  }
}

export {};
