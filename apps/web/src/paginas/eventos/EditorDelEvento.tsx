import { useConfiguracionPrecios } from '@/hooks/use-configuracion-precios';
import { useConsulta } from '@/hooks/use-presupuestos';
import { useSalones } from '@/hooks/use-salones';
import { useServicios } from '@/hooks/use-servicios';
import { EditarConsultaPorDias } from '@/paginas/presupuestos/EditarConsultaPorDias';

/**
 * La pestaña Detalle de un evento (15/11/2026): el mismo editor de la consulta, ahí mismo, sin llevar
 * a otra pantalla. Un evento confirmado o cobrado se edita completo, como una consulta más (RN-09: el
 * Responsable de Eventos y la gerencia deciden qué cambiar). Uno cancelado se ve sin poder cambiarse.
 */
export function EditorDelEvento({
  presupuestoId,
  accionIzquierda,
  onImprimirComanda,
  onSinGuardar,
}: {
  presupuestoId: number;
  // Abajo a la izquierda, al nivel de «Guardar cambios»: cancelar el evento.
  accionIzquierda?: React.ReactNode;
  // La comanda de cocina de un día, desde ese día.
  onImprimirComanda?: (presupuestoId: number, dia?: number) => void;
  onSinGuardar?: (hay: boolean) => void;
}) {
  const consulta = useConsulta(presupuestoId);
  const salones = useSalones();
  const servicios = useServicios();
  const configuracion = useConfiguracionPrecios();

  if (consulta.isError || salones.isError || servicios.isError || configuracion.isError) {
    return <p className="text-sm text-destructive">No se pudo cargar el detalle del evento.</p>;
  }
  if (!consulta.data || !salones.data || !servicios.data || !configuracion.data) {
    return <p className="text-sm text-muted-foreground">Cargando el detalle…</p>;
  }
  return (
    <EditarConsultaPorDias
      consulta={consulta.data}
      salones={salones.data}
      catalogo={servicios.data}
      porcentajeMensual={configuracion.data.porcentajeMensual}
      incrustado
      accionIzquierda={accionIzquierda}
      onImprimirComanda={onImprimirComanda}
      onSinGuardar={onSinGuardar}
    />
  );
}
