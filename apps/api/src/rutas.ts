import { Router } from 'express';

import { rutasAuth } from './modulos/auth/auth.rutas.js';
import { rutasClientes } from './modulos/clientes/clientes.rutas.js';
import { rutasEventos } from './modulos/eventos/eventos.rutas.js';
import { rutasMediosPago, rutasPagos } from './modulos/pagos/pagos.rutas.js';
import { rutasPresupuestos } from './modulos/presupuestos/presupuestos.rutas.js';
import { rutasSalones } from './modulos/salones/salones.rutas.js';
import { rutasSalud } from './modulos/salud/salud.rutas.js';
import { rutasServicios } from './modulos/servicios/servicios.rutas.js';
import { rutasSolicitudes } from './modulos/solicitudes/solicitudes.rutas.js';

// Router raíz de la API: cada módulo se monta acá bajo su prefijo.
export const rutasApi = Router();

rutasApi.use('/clientes', rutasClientes);
rutasApi.use('/eventos', rutasEventos);
// Los pagos son un recurso anidado del evento (/eventos/:id/pagos), pero son un módulo aparte: se
// monta un segundo router bajo el mismo prefijo y Express lo prueba cuando rutasEventos no matchea.
rutasApi.use('/eventos', rutasPagos);
rutasApi.use('/medios-pago', rutasMediosPago);
rutasApi.use('/presupuestos', rutasPresupuestos);
rutasApi.use('/salud', rutasSalud);
rutasApi.use('/servicios', rutasServicios);
rutasApi.use('/auth', rutasAuth);
rutasApi.use('/solicitudes', rutasSolicitudes);
rutasApi.use('/salones', rutasSalones);
