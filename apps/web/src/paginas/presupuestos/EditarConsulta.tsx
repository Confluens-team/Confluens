import { type ConsultaDetallada, veAuditoria } from '@confluens/shared';
import { ArrowLeft, FileText, History, Wallet } from 'lucide-react';
import { useState } from 'react';

import { Cargando } from '@/components/PantallaDeCarga';
import { Pestanias } from '@/components/Pestanias';
import { Button } from '@/components/ui/button';
import { useConfiguracionPrecios } from '@/hooks/use-configuracion-precios';
import { useConsulta } from '@/hooks/use-presupuestos';
import { useSalones } from '@/hooks/use-salones';
import { useSesion } from '@/hooks/use-sesion';
import { useServicios } from '@/hooks/use-servicios';
import { EditarConsultaPorDias } from './EditarConsultaPorDias';
import { type PestaniaDeConsulta } from './EncabezadoDeConsulta';
import { PresupuestoFormal } from './PresupuestoFormal';

// HU-12: una consulta abierta desde el listado, la agenda o la ficha del cliente. Después de hablar
// con el cliente, el personal corrige fechas, tipo, y día por día el horario, las personas, los
// salones con su distribución, los servicios y los precios (EditarConsultaPorDias). Los datos del
// cliente son suyos: acá solo se muestran.
//
// Desde el 15/11/2026 una consulta de un solo día usa la misma pantalla que una de varios días (sin
// la cinta): antes tenía un formulario propio, con un bloque vacío para la plantilla del evento social
// (S-14) que no se podía cargar.
export function EditarConsulta({
  id,
  onVolver,
  onGuardada,
  onDadaDeBaja,
  onImprimirComanda,
  textoVolver = 'Volver a las consultas',
  textoVolverAlGuardar = 'Volver al inicio',
}: {
  id: number;
  onVolver: () => void;
  // Ya no se llama al guardar: guardar deja la consulta abierta con un aviso, y esto es lo que
  // hace el botón de volver de ese aviso, con la consulta tal como quedó guardada.
  onGuardada: (consulta: ConsultaDetallada) => void;
  onDadaDeBaja: (consulta: ConsultaDetallada) => void;
  // Comanda de cocina del evento confirmado. Sin esto el botón no aparece: desde Consultas no se
  // llega a un presupuesto Confirmado, solo desde la agenda.
  onImprimirComanda?: (presupuestoId: number, dia?: number) => void;
  // Se abre desde Consultas o desde un evento de la agenda (HU-15).
  textoVolver?: string;
  // El botón del aviso de guardado; arma también la pregunta («¿Querés volver al inicio?»).
  textoVolverAlGuardar?: string;
}) {
  const consulta = useConsulta(id);
  const salones = useSalones();
  const servicios = useServicios();
  const configuracion = useConfiguracionPrecios();
  // El presupuesto en PDF para el envío formal. El formulario queda montado (oculto) para no perder
  // lo que se estaba editando.
  const [documentoAbierto, setDocumentoAbierto] = useState(false);
  function alternarDocumento(abierto: boolean) {
    setDocumentoAbierto(abierto);
    window.scrollTo({ top: 0 });
  }
  // 15/11/2026: Detalle, Pagos o Historial, arriba a la derecha del título. Pagos es el cobro del
  // evento (antes, «Registrar pagos» llevaba al evento). El Historial (diseño D) lo ven solo los
  // roles que ven la auditoría.
  const [pestania, setPestania] = useState<PestaniaDeConsulta>('detalle');
  // Lo que se cambió en Detalle y no se guardó se descarta al ir a otra pestaña (16/11/2026):
  // descartar es volver a montar el editor, que arranca con lo guardado.
  const [detalleSinGuardar, setDetalleSinGuardar] = useState(false);
  const [versionDelDetalle, setVersionDelDetalle] = useState(0);
  function cambiarPestania(nueva: PestaniaDeConsulta) {
    if (pestania === 'detalle' && nueva !== 'detalle' && detalleSinGuardar) {
      if (
        !window.confirm('Hay cambios sin guardar en Detalle. Si cambiás de pestaña se descartan.')
      ) {
        return;
      }
      setVersionDelDetalle((version) => version + 1);
      setDetalleSinGuardar(false);
    }
    setPestania(nueva);
  }
  const { data: sesion } = useSesion();
  const veHistorial = !!sesion && veAuditoria(sesion.rol);
  const pestanias = (
    <Pestanias<PestaniaDeConsulta>
      etiqueta="Secciones de la consulta"
      valor={pestania}
      onCambiar={cambiarPestania}
      pestanias={[
        { valor: 'detalle', texto: 'Detalle', icono: FileText },
        { valor: 'pagos', texto: 'Pagos', icono: Wallet },
        ...(veHistorial
          ? [{ valor: 'historial' as const, texto: 'Historial', icono: History }]
          : []),
      ]}
    />
  );
  const pestaniaVisible: PestaniaDeConsulta =
    pestania === 'historial' && !veHistorial ? 'detalle' : pestania;

  // El formulario no cambia de lugar en el árbol al abrir el documento: si cambiara, React lo
  // volvería a montar y se perdería lo editado.
  return (
    <>
      {documentoAbierto && consulta.data && (
        <PresupuestoFormal consulta={consulta.data} onVolver={() => alternarDocumento(false)} />
      )}
      <div className={documentoAbierto ? 'hidden' : 'space-y-4'}>
        <Button variant="ghost" size="sm" onClick={onVolver}>
          <ArrowLeft /> {textoVolver}
        </Button>
        {(consulta.isLoading ||
          salones.isLoading ||
          servicios.isLoading ||
          configuracion.isLoading) && <Cargando texto="Cargando la consulta…" />}
        {(consulta.isError || salones.isError || servicios.isError || configuracion.isError) && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            No se pudo cargar la consulta.
          </p>
        )}
        {consulta.data && salones.data && servicios.data && configuracion.data && (
          <EditarConsultaPorDias
            key={versionDelDetalle}
            onSinGuardar={setDetalleSinGuardar}
            consulta={consulta.data}
            salones={salones.data}
            catalogo={servicios.data}
            porcentajeMensual={configuracion.data.porcentajeMensual}
            onGuardada={onGuardada}
            onDadaDeBaja={onDadaDeBaja}
            onImprimirComanda={onImprimirComanda}
            onDescargarPresupuesto={() => alternarDocumento(true)}
            textoVolverAlGuardar={textoVolverAlGuardar}
            pestania={pestaniaVisible}
            pestanias={pestanias}
          />
        )}
      </div>
    </>
  );
}
