// Envío de correos con Resend (ADR 0006), por su API HTTP: no hace falta su SDK para un único
// endpoint. Las variables se leen de process.env y no de config/entorno.ts por el mismo motivo que
// JWT_SECRET en jwt.ts (ADR 0003): los tests corren sin variables de entorno.

const URL_RESEND = 'https://api.resend.com/emails';

// Mientras no haya un dominio verificado en Resend, el remitente de prueba de Resend solo puede
// enviar al correo del dueño de la cuenta. Con dominio propio, se configura en CORREO_REMITENTE.
const REMITENTE_POR_DEFECTO = 'Los Abuelos <onboarding@resend.dev>';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

export async function enviarCorreo(correo: Correo): Promise<void> {
  const clave = process.env['RESEND_API_KEY'];
  if (!clave) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('RESEND_API_KEY es obligatorio en producción');
    }
    // En desarrollo, sin clave, el correo se muestra en la consola de la API para poder seguir el
    // flujo completo (por ejemplo, abrir el enlace para restablecer la contraseña).
    console.info(
      `[correo sin enviar: falta RESEND_API_KEY]\nPara: ${correo.para}\nAsunto: ${correo.asunto}\n\n${correo.texto}\n`,
    );
    return;
  }

  const respuesta = await fetch(URL_RESEND, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env['CORREO_REMITENTE'] ?? REMITENTE_POR_DEFECTO,
      to: correo.para,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    }),
  });
  if (!respuesta.ok) {
    throw new Error(`Resend respondió ${respuesta.status}: ${await respuesta.text()}`);
  }
}
