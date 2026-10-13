// Constantes de las reglas de negocio del evento en sí. Las usan los dos lados: la web para topear
// los campos del formulario y la API para rechazar el body.

// Tope de asistentes de un evento. Un evento corporativo además queda limitado por la capacidad
// máxima del salón que elige; uno social no elige salón (ADR 0008), así que este es su único techo.
// El valor es un máximo del negocio, no una capacidad real: el salón más grande entra 280 personas
// en conferencia.
export const MAXIMO_PERSONAS_EVENTO = 500;
