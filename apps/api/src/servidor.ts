import { crearApp } from './app.js';
import { cargarEntorno } from './config/entorno.js';
import { iniciarTrabajosProgramados } from './trabajos/index.js';

const entorno = cargarEntorno();

crearApp().listen(entorno.PORT, () => {
  console.log(`API escuchando en http://localhost:${entorno.PORT} (docs en /api/docs)`);
});
iniciarTrabajosProgramados();
