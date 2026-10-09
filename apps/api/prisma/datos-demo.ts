// Datos de demostración para la base local: una consulta por cada estado de evento y de
// presupuesto, todas en octubre de 2026. No es parte del seed ni del producto: sirve para tener la
// agenda y el listado de consultas con algo que mirar después de un reset.
//
// Uso, desde apps/api:  npx tsx --env-file=../../.env prisma/datos-demo.ts
//
// Importes sin IVA (RN-05). La base de cobro de los pagos sale de RN-01: con factura es el total
// más el 21%, sin factura es el total pelado. Los salones y servicios se referencian por nombre
// para no depender de los ids del seed.
import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/lib/prisma.js';

const IVA = new Prisma.Decimal('1.21');

function dec(valor: string | number) {
  return new Prisma.Decimal(valor);
}

// Fecha del evento: columna @db.Date, se guarda sin hora.
function fecha(dia: string) {
  return new Date(`${dia}T00:00:00.000Z`);
}

// Horario real del evento (inicio/fin). Obligatorio salvo en EnConsulta y Cancelado.
//
// Sin la `Z` a propósito: así JavaScript lo interpreta como hora local y guarda el instante que le
// corresponde, igual que hace la web al agendar (`new Date(inicio).toISOString()` en
// CuentaDelEvento.tsx). Con `Z` el horario se guardaba en UTC crudo y la agenda lo mostraba
// corrido tres horas para atrás.
function hora(dia: string, hhmm: string) {
  return new Date(`${dia}T${hhmm}:00`);
}

async function main() {
  const salones = await prisma.salon.findMany({ include: { distribuciones: true } });
  const servicios = await prisma.servicio.findMany();
  const medios = await prisma.medioPago.findMany();

  const salon = (nombre: string) => {
    const encontrado = salones.find((s) => s.nombre === nombre);
    if (!encontrado) throw new Error(`Falta el salón ${nombre}: ¿corriste el seed?`);
    return encontrado;
  };
  const distribucion = (nombreSalon: string, nombre: string) => {
    const encontrada = salon(nombreSalon).distribuciones.find((d) => d.nombre === nombre);
    if (!encontrada) throw new Error(`Falta la distribución ${nombre} de ${nombreSalon}`);
    return encontrada;
  };
  const servicio = (nombre: string) => {
    const encontrado = servicios.find((s) => s.nombre === nombre);
    if (!encontrado) throw new Error(`Falta el servicio ${nombre}: ¿corriste el seed?`);
    return encontrado;
  };
  const medio = (nombre: string) => {
    const encontrado = medios.find((m) => m.nombre === nombre);
    if (!encontrado) throw new Error(`Falta el medio de pago ${nombre}`);
    return encontrado;
  };

  // ── 1. EnConsulta · presupuesto Estimado vigente ────────────────────────────────────────────
  const pucara = salon('Pucará');
  const coffeeExpress = servicio('Coffee Express');
  const personas1 = 55;
  const linea1Salon = dec(pucara.precioMediaJornada);
  const linea1Coffee = dec(coffeeExpress.precio!).times(personas1);
  const total1 = linea1Salon.plus(linea1Coffee);

  const cliente1 = await prisma.cliente.create({
    data: {
      nombre: 'Mariana',
      apellido: 'Gómez',
      telefono: '3514445566',
      correo: 'mariana.gomez@example.com',
    },
  });
  const evento1 = await prisma.evento.create({
    data: {
      clienteId: cliente1.id,
      salonId: pucara.id,
      distribucionId: distribucion('Pucará', 'Mesas de trabajo').id,
      fecha: fecha('2026-10-14'),
      cantidadPersonas: personas1,
      estado: 'EnConsulta',
      tipo: 'Corporativo',
      tipoJornada: 'media',
      horaInicioEstimada: '09:00',
    },
  });
  await prisma.presupuesto.create({
    data: {
      eventoId: evento1.id,
      estado: 'Estimado',
      fechaEmision: hora('2026-10-06', '10:00'),
      venceEn: hora('2026-10-16', '10:00'),
      total: total1,
      requiereFactura: false,
      lineas: {
        create: [
          {
            descripcion: `Salón ${pucara.nombre} · media jornada`,
            cantidad: 1,
            precioUnitario: linea1Salon,
            subtotal: linea1Salon,
          },
          {
            servicioId: coffeeExpress.id,
            descripcion: coffeeExpress.nombre,
            cantidad: personas1,
            precioUnitario: dec(coffeeExpress.precio!),
            subtotal: linea1Coffee,
          },
        ],
      },
    },
  });

  // ── 2. EnConsulta · presupuesto sin armar (consulta social, ADR 0008) ───────────────────────
  const cliente2 = await prisma.cliente.create({
    data: {
      nombre: 'Lucía',
      apellido: 'Peralta',
      telefono: '3517778899',
      correo: 'lucia.peralta@example.com',
    },
  });
  const evento2 = await prisma.evento.create({
    data: {
      clienteId: cliente2.id,
      fecha: fecha('2026-10-31'),
      cantidadPersonas: 80,
      estado: 'EnConsulta',
      tipo: 'Social',
      tipoSocial: 'Casamiento',
    },
  });
  // Sin líneas, total 0 y venceEn null: así la web lo muestra como "Presupuesto por armar".
  await prisma.presupuesto.create({
    data: {
      eventoId: evento2.id,
      estado: 'Estimado',
      fechaEmision: hora('2026-10-07', '18:30'),
      venceEn: null,
      total: dec(0),
      requiereFactura: false,
    },
  });

  // ── 3. EnConsulta · presupuesto Expirado ────────────────────────────────────────────────────
  const iguazu = salon('Iguazú');
  const coffeeRefresh = servicio('Coffee Refresh');
  const personas3 = 35;
  const linea3Salon = dec(iguazu.precioMediaJornada);
  const linea3Coffee = dec(coffeeRefresh.precio!).times(personas3);
  const total3 = linea3Salon.plus(linea3Coffee);

  const cliente3 = await prisma.cliente.create({
    data: {
      nombre: 'Grupo Andino SRL',
      telefono: '3512223344',
      correo: 'contacto@grupoandino.example.com',
    },
  });
  const evento3 = await prisma.evento.create({
    data: {
      clienteId: cliente3.id,
      salonId: iguazu.id,
      distribucionId: distribucion('Iguazú', 'Conferencia').id,
      fecha: fecha('2026-10-09'),
      cantidadPersonas: personas3,
      estado: 'EnConsulta',
      tipo: 'Corporativo',
      tipoJornada: 'media',
    },
  });
  await prisma.presupuesto.create({
    data: {
      eventoId: evento3.id,
      estado: 'Expirado',
      fechaEmision: hora('2026-09-20', '11:00'),
      venceEn: hora('2026-09-30', '11:00'),
      total: total3,
      requiereFactura: false,
      lineas: {
        create: [
          {
            descripcion: `Salón ${iguazu.nombre} · media jornada`,
            cantidad: 1,
            precioUnitario: linea3Salon,
            subtotal: linea3Salon,
          },
          {
            servicioId: coffeeRefresh.id,
            descripcion: coffeeRefresh.nombre,
            cantidad: personas3,
            precioUnitario: dec(coffeeRefresh.precio!),
            subtotal: linea3Coffee,
          },
        ],
      },
    },
  });

  // ── 4. Reservado · seña del 20% acreditada, con factura ─────────────────────────────────────
  const auditorio = salon('Auditorio');
  const coffeeIntermedio = servicio('Coffee Intermedio');
  const personas4 = 180;
  const linea4Salon = dec(auditorio.precioJornadaCompleta);
  const linea4Coffee = dec(coffeeIntermedio.precio!).times(personas4);
  const total4 = linea4Salon.plus(linea4Coffee);
  // RN-01: con factura la base de cobro es el total más el IVA.
  const base4 = total4.times(IVA).toDecimalPlaces(2);
  const sena4 = base4.times(20).dividedBy(100).toDecimalPlaces(2);

  const cliente4 = await prisma.cliente.create({
    data: {
      nombre: 'Cooperativa El Molino',
      telefono: '3515556677',
      correo: 'administracion@elmolino.example.com',
    },
  });
  const evento4 = await prisma.evento.create({
    data: {
      clienteId: cliente4.id,
      salonId: auditorio.id,
      distribucionId: distribucion('Auditorio', 'Mesas de trabajo').id,
      fecha: fecha('2026-10-21'),
      inicio: hora('2026-10-21', '09:00'),
      fin: hora('2026-10-21', '18:00'),
      cantidadPersonas: personas4,
      estado: 'Reservado',
      tipo: 'Corporativo',
      tipoJornada: 'completa',
      senaRegistradaEn: hora('2026-10-02', '15:20'),
    },
  });
  await prisma.presupuesto.create({
    data: {
      eventoId: evento4.id,
      estado: 'Confirmado',
      fechaEmision: hora('2026-09-28', '09:30'),
      venceEn: hora('2026-10-08', '09:30'),
      total: total4,
      requiereFactura: true,
      lineas: {
        create: [
          {
            descripcion: `Salón ${auditorio.nombre} · jornada completa`,
            cantidad: 1,
            precioUnitario: linea4Salon,
            subtotal: linea4Salon,
          },
          {
            servicioId: coffeeIntermedio.id,
            descripcion: coffeeIntermedio.nombre,
            cantidad: personas4,
            precioUnitario: dec(coffeeIntermedio.precio!),
            subtotal: linea4Coffee,
          },
        ],
      },
    },
  });
  await prisma.pago.create({
    data: {
      eventoId: evento4.id,
      fecha: fecha('2026-10-02'),
      monto: sena4,
      medioPagoId: medio('Tarjeta').id,
      observacion: 'Seña del 20% (RN-01, base con IVA por requerir factura)',
    },
  });

  // ── 5. Cobrado · pagado el 100%, sin factura ────────────────────────────────────────────────
  const bariloche = salon('Bariloche');
  const coffeeEspecial = servicio('Coffee Especial');
  const personas5 = 48;
  const linea5Salon = dec(bariloche.precioJornadaCompleta);
  const linea5Coffee = dec(coffeeEspecial.precio!).times(personas5);
  const total5 = linea5Salon.plus(linea5Coffee);
  // Sin factura la base es el total pelado. Se cubre en dos pagos: seña y saldo.
  const primerPago5 = dec('400000');
  const saldo5 = total5.minus(primerPago5);

  const cliente5 = await prisma.cliente.create({
    data: {
      nombre: 'Estudio Ferreyra',
      telefono: '3518889900',
      correo: 'hola@estudioferreyra.example.com',
    },
  });
  const evento5 = await prisma.evento.create({
    data: {
      clienteId: cliente5.id,
      salonId: bariloche.id,
      distribucionId: distribucion('Bariloche', 'Banquete').id,
      fecha: fecha('2026-10-17'),
      inicio: hora('2026-10-17', '12:00'),
      fin: hora('2026-10-17', '20:00'),
      cantidadPersonas: personas5,
      estado: 'Cobrado',
      tipo: 'Corporativo',
      tipoJornada: 'completa',
      senaRegistradaEn: hora('2026-09-25', '12:10'),
    },
  });
  await prisma.presupuesto.create({
    data: {
      eventoId: evento5.id,
      estado: 'Confirmado',
      fechaEmision: hora('2026-09-22', '16:00'),
      venceEn: hora('2026-10-02', '16:00'),
      total: total5,
      requiereFactura: false,
      lineas: {
        create: [
          {
            descripcion: `Salón ${bariloche.nombre} · jornada completa`,
            cantidad: 1,
            precioUnitario: linea5Salon,
            subtotal: linea5Salon,
          },
          {
            servicioId: coffeeEspecial.id,
            descripcion: coffeeEspecial.nombre,
            cantidad: personas5,
            precioUnitario: dec(coffeeEspecial.precio!),
            subtotal: linea5Coffee,
          },
        ],
      },
    },
  });
  await prisma.pago.createMany({
    data: [
      {
        eventoId: evento5.id,
        fecha: fecha('2026-09-25'),
        monto: primerPago5,
        medioPagoId: medio('Efectivo').id,
        observacion: 'Seña',
      },
      {
        eventoId: evento5.id,
        fecha: fecha('2026-10-06'),
        monto: saldo5,
        medioPagoId: medio('Tarjeta').id,
        observacion: 'Saldo',
      },
    ],
  });

  // ── 6. Cancelado · presupuesto Cancelado ────────────────────────────────────────────────────
  const parana = salon('Paraná');
  const total6 = dec(parana.precioMediaJornada);

  const cliente6 = await prisma.cliente.create({
    data: {
      nombre: 'Hernán',
      apellido: 'Suárez',
      telefono: '3511112233',
      correo: 'hernan.suarez@example.com',
    },
  });
  const evento6 = await prisma.evento.create({
    data: {
      clienteId: cliente6.id,
      salonId: parana.id,
      distribucionId: distribucion('Paraná', 'Banquete').id,
      fecha: fecha('2026-10-28'),
      cantidadPersonas: 12,
      estado: 'Cancelado',
      tipo: 'Social',
      tipoSocial: 'Cumpleanos',
      tipoJornada: 'media',
    },
  });
  await prisma.presupuesto.create({
    data: {
      eventoId: evento6.id,
      estado: 'Cancelado',
      fechaEmision: hora('2026-10-01', '13:00'),
      venceEn: hora('2026-10-11', '13:00'),
      total: total6,
      requiereFactura: false,
      lineas: {
        create: [
          {
            descripcion: `Salón ${parana.nombre} · media jornada`,
            cantidad: 1,
            precioUnitario: total6,
            subtotal: total6,
          },
        ],
      },
    },
  });

  console.log('Datos de demo creados. Totales sin IVA:');
  console.table([
    { n: 1, evento: 'EnConsulta', presupuesto: 'Estimado', total: total1.toFixed(2) },
    { n: 2, evento: 'EnConsulta', presupuesto: 'Estimado (sin armar)', total: '0.00' },
    { n: 3, evento: 'EnConsulta', presupuesto: 'Expirado', total: total3.toFixed(2) },
    { n: 4, evento: 'Reservado', presupuesto: 'Confirmado', total: total4.toFixed(2) },
    { n: 5, evento: 'Cobrado', presupuesto: 'Confirmado', total: total5.toFixed(2) },
    { n: 6, evento: 'Cancelado', presupuesto: 'Cancelado', total: total6.toFixed(2) },
  ]);
  console.log(`Seña del 4 (base con IVA ${base4.toFixed(2)}): ${sena4.toFixed(2)}`);
  console.log(
    `Pagos del 5: ${primerPago5.toFixed(2)} + ${saldo5.toFixed(2)} = ${total5.toFixed(2)}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
