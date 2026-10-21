import { DIAS_VIGENCIA_PRESUPUESTO } from '@confluens/shared';

import { HojaA4 } from './HojaA4';

// Las condiciones de contratación del presupuesto formal, con el texto y el diseño del PDF que Fran
// les manda hoy a los clientes, en las mismas tres hojas. Única diferencia: la validez es la del
// sistema (RN-08, 10 días) y no los 30 días del PDF (decisión de Franco, 21/10/2026). La numeración
// repetida (e, f, g) es la del original.
const HOJAS: { continuacion?: string; items: string[] }[] = [
  {
    items: [
      'a) Se aclara que el acto de responder o presupuesto enviado por consultas de eventos, no implica la aceptación del evento por parte de la empresa.',
      'b) Los gastos extras o no incluido en el presupuesto, serán abonados al concluir el evento.',
      'c) Para la confirmación de los servicios solicitados se deberá abonar un 20% del total del evento dentro de los 10 días a partir de su confirmación.',
      'd) Deberá confirmarse 7 días antes del evento la cantidad de asistentes del evento, solo se contemplaran modificaciones de hasta 5 personas más, 48hs antes del evento. En caso que no asistiesen la cantidad de personas, se cobrara la cantidad contratada.',
      'e) Si no se produjera el anticipo antes mencionado, en el plazo allí indicado, nuestro Hotel se libera de inmediato de toda responsabilidad por la reserva efectuada.',
      'f) Cancelación total del evento deberá realizarse 48.00 hs hábiles antes del mismo.',
      'g) Si el evento se cancelara, el monto de la reserva no será reintegrado. Tampoco podrá ser aplicado al pago de otros servicios Gastronómicos y/o del Hotel. e) Los valores mencionados incluyen IVA.',
      'f) Los valores están sujetos a modificación según variación de los precios del mercado.',
    ],
  },
  {
    items: [
      'g) Los eventos que soliciten factura en condición “A” deberán presentar el formulario 8001 de afip antes de realizarse la facturación y posterior comunicación al ejecutivo de cuentas. En caso de ser responsables inscriptos, solicitamos nos informen si son agentes de retención y percepción de iva.',
      'h) Los pagos se pueden efectuar en efectivo, cheque, transferencia o tarjeta. En caso de realizar los pagos en cheques, este deberá estar a nombre de Los Abuelos Servicios Gastronomicos SRL, Cuit: 3071535756-5',
      'En caso de transferir, se adjuntara por e-mail la cuenta bancaria, luego deberá enviar el comprobante de pago.',
      'i) Tasas y gravámenes: Los aranceles correspondientes a SADAIC (Mauricio 152368379) y AADICAPIF (Marisa 157585104) no están incluidos, y deben estar abonados antes del evento. Estos son en casos de que el evento incluya un show musical.',
      'j) Armado de salón: En caso que requiera de un armado especial o decoración, deberá informarle al ejecutivo de cuentas para verificar la disponibilidad de tiempos adicionales, ya que nuestros salones pueden ser utilizados durante el mismo dia del evento.',
      'k) No está permitido el ingreso al hotel y/o los salones con ninguna clase de alimentos y/o bebidas por parte del cliente, proveedores, invitados u otras personas que participen del evento. l) Cláusula de Responsabilidad: El hotel no se responsabiliza por la',
    ],
  },
  {
    continuacion:
      'pérdida/daño/extravío de los objetos en los salones o áreas públicas del mismo. Como así de los vehículos estacionados en la playa del hotel.',
    items: [
      'm) La recepción de mercadería/materiales deberá ser trasladada al salón o al sector de resguardo, por propio personal del evento. Y deberá ser retirada al momento de finalización del evento. El hotel no se responsabiliza por los objetos dejados en sus instalaciones.',
      'n) Armado y Montaje: No se permite clavar ni pegar material decorativo en las instalaciones del hotel y/o salones (paredes, vidrios, puertas, etc.)',
      `o) La validez del presupuesto es de ${DIAS_VIGENCIA_PRESUPUESTO} días.`,
    ],
  },
];

export function CondicionesContratacion() {
  return HOJAS.map(({ continuacion, items }, indice) => (
    <HojaA4 key={indice} className="print:break-inside-avoid">
      <img
        src="/presupuesto-formal/condiciones-cabecera.jpg"
        alt=""
        className="block aspect-[1240/313] w-full object-cover"
      />
      <div className="px-[6%] pt-[7%] pb-[6%]">
        <h2 className="font-sans text-[26pt] leading-tight font-bold tracking-[0.12em] text-bordo uppercase">
          Condiciones de contratación:
        </h2>
        {continuacion && <p className="mt-6 text-[12.5pt] italic">{continuacion}</p>}
        <ul className="mt-6 list-disc space-y-1 pl-[5%] text-[12.5pt] leading-snug italic">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </HojaA4>
  ));
}
