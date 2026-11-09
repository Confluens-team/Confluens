// Contenido institucional de la landing (HU-07): ubicación, redes, formatos de armado, qué está
// incluido sin cargo y condiciones de contratación. Es estático a propósito: no son datos que el
// sistema administre (no hay entidad ni pantalla de alta para ellos) y no cambian por operación,
// a diferencia de salones y servicios, que sí se leen de la base.
//
// Los formatos, lo incluido y las condiciones se transcriben de docs/negocio/tarifario-2026.md
// (tarifario vigente del cliente). Si el tarifario cambia, se actualiza acá.

// Aportados por el equipo, todavía no están en docs/negocio/: conviene confirmarlos con el cliente
// antes del deploy. Solo se publica Instagram porque es la única red confirmada — no se inventan
// Facebook, WhatsApp ni teléfono.
export const UBICACION = {
  direccion: 'Av. Sabattini 459',
  localidad: 'Córdoba, Argentina',
  mapaUrl: 'https://www.google.com/maps/search/?api=1&query=Av.+Sabattini+459,+Córdoba,+Argentina',
  // Vista del mapa en la sección "Ubicación". Es el embed sin API key; el click sobre el mapa no
  // lo mueve sino que abre mapaUrl en Google Maps. Contra: Google recibe la visita de cualquiera
  // que entre a la landing (decisión del equipo, que antes publicaba solo el link).
  mapaEmbedUrl: 'https://www.google.com/maps?q=Av.+Sabattini+459,+Córdoba,+Argentina&output=embed',
} as const;

export const INSTAGRAM = {
  usuario: '@hoteldrcesarcarman',
  url: 'https://instagram.com/hoteldrcesarcarman',
} as const;

// tarifario-2026.md:23-24
export const FORMATOS_DE_ARMADO = [
  'Auditorio',
  'Escuela',
  'Imperial',
  'Montaje en U',
  'Banquete',
] as const;

// tarifario-2026.md:46-48
export const INCLUIDO_SIN_CARGO = [
  'Podio para locutor y atriles',
  'Rotafolios',
  'Sanitarios en planta baja y subsuelo',
  'Ambiente climatizado',
  'Wi-fi',
  'Servicio de gastronomía',
  'Asistencia médica permanente',
  'Estacionamiento gratuito para hasta 100 autos',
] as const;

// tarifario-2026.md, "Condiciones de contratación" (actualizadas en la entrevista del 24/09/2026).
// Se publican las condiciones, no las reglas RN-xx que originan: al cliente le importa el plazo,
// no el identificador interno. Están redactadas en lenguaje llano y de vos a vos, como el resto de
// la landing, pero sin agregar nada que el tarifario no diga.
export const CONDICIONES_DE_CONTRATACION = [
  {
    condicion: 'Precios',
    detalle:
      'Los precios no incluyen IVA. En tu presupuesto vas a ver el subtotal, el IVA del 21% y el total final.',
  },
  {
    condicion: 'Seña',
    detalle:
      'Para reservar, abonás una seña del 20% del total mientras el presupuesto esté vigente. Desde ese momento, los precios quedan congelados.',
  },
  {
    condicion: 'Validez del presupuesto',
    detalle: 'Tu presupuesto vale por 10 días desde que es emitido.',
  },
  {
    condicion: 'Falta de anticipo',
    detalle:
      'Si pasan los 10 días sin seña, no se cancela nada: solo recalculamos el presupuesto con los precios del momento.',
  },
  {
    condicion: 'Cancelación',
    detalle:
      'Podés cancelar hasta 48 horas antes del evento. Se cuentan horas corridas, incluidos fines de semana y feriados.',
  },
  {
    condicion: 'Reintegro',
    detalle: 'La seña no se devuelve ni se puede usar para otros servicios.',
  },
  {
    condicion: 'Modificaciones',
    detalle:
      'Podés hacer cambios, incluida la cantidad de invitados, hasta 7 días antes del evento. Después, cualquier cambio lo coordinás con nuestro equipo de eventos.',
  },
  {
    condicion: 'Ausencias',
    detalle: 'Si vienen menos invitados de los previstos, se cobra la cantidad que contrataste.',
  },
  {
    condicion: 'Gastos extra',
    detalle: 'Los gastos extra que surjan durante el evento se pagan al finalizar.',
  },
  {
    condicion: 'Medios de pago',
    detalle: 'Podés pagar en efectivo, con cheque, por transferencia o con tarjeta.',
  },
  {
    condicion: 'Armado y montaje',
    detalle: 'La decoración no se puede clavar ni pegar en los salones.',
  },
  {
    condicion: 'Ingreso de alimentos',
    detalle: 'No se puede ingresar comida de afuera: ni vos, ni tus proveedores, ni tus invitados.',
  },
] as const;
