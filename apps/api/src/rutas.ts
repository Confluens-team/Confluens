import { Router } from 'express';

import { rutasAuth } from './modulos/auth/auth.rutas.js';
import { rutasClientes } from './modulos/clientes/clientes.rutas.js';
import { rutasEventos } from './modulos/eventos/eventos.rutas.js';
import { rutasPresupuestos } from './modulos/presupuestos/presupuestos.rutas.js';
import { rutasSalones } from './modulos/salones/salones.rutas.js';
import { rutasSalud } from './modulos/salud/salud.rutas.js';
import { rutasServicios } from './modulos/servicios/servicios.rutas.js';
import { rutasSolicitudes } from './modulos/solicitudes/solicitudes.rutas.js';

// Router raíz de la API: cada módulo se monta acá bajo su prefijo.
export const rutasApi = Router();

rutasApi.use('/clientes', rutasClientes);
rutasApi.use('/eventos', rutasEventos);
rutasApi.use('/presupuestos', rutasPresupuestos);
rutasApi.use('/salud', rutasSalud);
rutasApi.use('/servicios', rutasServicios);
rutasApi.use('/auth', rutasAuth);
rutasApi.use('/solicitudes', rutasSolicitudes);
rutasApi.use('/salones', rutasSalones);
