import cron from 'node-cron';

import { controlarVigencia } from './vigencia.trabajo.js';

function ejecutarControlDeVigencia(): void {
  controlarVigencia().catch((error: unknown) => {
    console.error('Error en el control de vigencia de presupuestos:', error);
  });
}

// RN-08: la vigencia se mide en días, alcanza con revisarla cada hora. También corre al levantar la
// API, para no esperar a la próxima hora si estuvo apagada (por ejemplo, dormida en el hosting).
export function iniciarTrabajosProgramados(): void {
  ejecutarControlDeVigencia();
  cron.schedule('0 * * * *', ejecutarControlDeVigencia);
}
