# docs — Contexto del proyecto Confluens

Esta carpeta es la fuente de verdad para cualquier agente de IA que trabaje en este repo.
Se deriva de la documentación aprobada por la cátedra (carpeta de Drive "Documentación para subir")
y de la máquina de estados corregida.
Última actualización de reglas: entrevista con el Responsable de Eventos del **24/09/2026**
(canal público, IVA, vigencia de 10 días, incremento de precios, recargos). Si otro documento
contradice a `producto/dominio.md`, vale `dominio.md`.

## Protocolo de carga

No leas esta carpeta entera. Abrí solo lo que la tarea necesita.

| Si vas a… | Leé |
|---|---|
| Escribir cualquier código | `/AGENTS.md` (raíz) + `producto/dominio.md` |
| Crear archivos, nombrar cosas o correr comandos | + `tecnico/convenciones.md` |
| Implementar una historia del sprint en curso | + `producto/sprint-02.md` |
| Tocar el modelo de datos o los enums | + `tecnico/modelo-datos.md` |
| Cargar datos de prueba o precios | + `negocio/tarifario-2026.md` |
| Entender por qué algo está hecho así | + `tecnico/adr/` |
| Discutir alcance o prioridades | + `producto/backlog.md` |

Regla para el agente: si una definición que necesitás no está en estos archivos,
**no la inventes**. Está en `producto/pendientes.md` o hay que preguntar.

## Contenido

```
docs/
├── README.md                    ← este archivo
├── producto/
│   ├── dominio.md               Glosario, estados y reglas de negocio. El más importante.
│   ├── backlog.md               Las 46 historias en una línea cada una, con Epic, RD y sprint.
│   ├── sprint-01.md             Las 8 historias del Sprint 1, cerrado. Se conserva como referencia.
│   ├── sprint-02.md             Las 7 historias del Sprint 2 (en curso), con criterios completos.
│   └── pendientes.md            Lo que todavía no definió el cliente. Qué NO asumir.
├── tecnico/
│   ├── arquitectura.md          Monorepo, capas y límites entre workspaces.
│   ├── modelo-datos.md          Entidades, enums y la restricción de no solapamiento.
│   ├── convenciones.md          Nombres, archivos, schemas compartidos y comandos.
│   └── adr/                     Decisiones técnicas (0001 a 0008) + template.md.
└── negocio/
    └── tarifario-2026.md        Salones, capacidades y precios reales. Base de los seeds.
```

## Qué NO va acá

- El Plan de Proyecto y el Estudio Inicial completos. Viven en Drive; acá va solo lo destilado.
- Estado de tareas: eso es Jira. Nada de "en progreso" ni asignaciones en markdown.
- Notas de reunión y borradores académicos.

## Al cerrar cada sprint

Actualizar `producto/dominio.md` si cambió una regla, agregar el `producto/sprint-0X.md` del
sprint siguiente y apuntar a él la tabla del protocolo de carga (los sprints anteriores se
conservan como referencia, no se borran). Si la historia implicó una decisión técnica difícil de
revertir o que sorprendería a quien lea el código después, agregar una ADR en `tecnico/adr/`
copiando `template.md`, numerada, en el mismo PR. Máximo 2 por user story.
