# Inventario de propiedades del Inspector - Fase 8

## Alcance y fuente de verdad

Este inventario cruza el Plan Maestro de Fase 8 con el modelo y los handlers vigentes. Clasifica todas las propiedades que el Inspector ya presenta o edita, las variantes condicionales y los campos tipados que deliberadamente no se exponen.

La jerarquía objetivo es:

- **Frecuente:** disponible sin abrir el bloque avanzado.
- **Avanzado:** accesible mediante accordion persistente; nunca eliminado del flujo Completo.
- **Derivado:** lectura bloqueada, con unidad y explicación de su fuente.

`Editable` significa que se conserva el handler actual. `Bloqueado` significa solo lectura; la Fase 8 no habilita edición de IDs, asociaciones o resultados.

## Modelo real de selección

| Variante UX | Representación vigente | Regla de Fase 8 |
| --- | --- | --- |
| Ninguna | `selection === null` | Empty state útil; en Aula puede acompañarse por `ClassroomGuide`. |
| Nodo | `{ kind: 'node', id }` | Propiedades geométricas y de conexión del nodo. |
| Apoyo | El mismo `kind: 'node'`, con `node.support.type !== 'none'` | **Apoyo es una variante de Nodo**, no un nuevo tipo de selección ni un contrato nuevo. |
| Miembro | `{ kind: 'member', id }` | Tipo, geometría, propiedades deformables, conexiones y resultados. |
| Carga nodal | `{ kind: 'nodalLoad', id }` | Un solo registro contiene `fx`, `fy` y `mz`; puede ser fuerza, momento o una acción mixta. |
| Carga puntual de miembro | `{ kind: 'memberLoad', id }` y `load.type === 'point'` | Variante visual del mismo contrato `MemberLoad`. |
| Carga distribuida | `{ kind: 'memberLoad', id }` y `load.type === 'distributed'` | Variante visual del mismo contrato `MemberLoad`. |
| Momento de miembro | `{ kind: 'memberLoad', id }` y `load.type === 'moment'` | Variante visual del mismo contrato `MemberLoad`. |
| Múltiple | `{ kind: 'multi', nodeIds, memberIds }` | Solo admite nodos y miembros. **No edita propiedades en masa en Fase 8.** |

No se agregan kinds `support`, `pointLoad`, `distributedLoad` o `moment` a `Selection`.

## Convenciones de unidad

| Nombre usado en las tablas | Unidades visibles por sistema `kN-m / N-mm / kgf-m / kip-ft` |
| --- | --- |
| longitud | `m / mm / m / ft` |
| fuerza | `kN / N / kgf / kip` |
| momento | `kN·m / N·mm / kgf·m / kip·ft` |
| fuerza distribuida | `kN/m / N/mm / kgf/m / kip/ft` |
| módulo | `MPa / MPa / kgf/cm² / ksi` |
| área | `m² / mm² / cm² / in²` |
| inercia | `m⁴ / mm⁴ / cm⁴ / in⁴` |
| rigidez traslacional | `kN/m / N/mm / kgf/m / kip/ft` |
| rigidez rotacional | `kN·m/rad / N·mm/rad / kgf·m/rad / kip·ft/rad` |
| densidad | `kg/m³ / kg/m³ / kg/m³ / lb/ft³` |

`toDisplay`, `fromDisplay` y `unitLabel` de `src/engine/units.ts` siguen siendo la única fuente de conversión. `°`, `rad`, `1/°C`, `°C`, `°C/m`, adimensional y `1/m` se conservan como unidades técnicas actuales sin añadir conversiones.

## Ninguna selección y selección múltiple

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ninguna | Empty state y ayuda para seleccionar | Derivado | Bloqueado | - | Ambos; Aula añade guía contextual | No aplica | `Selection = null`; `Inspector`; `ClassroomGuide` |
| Múltiple | Cantidad total seleccionada | Derivado | Bloqueado | objetos | Ambos | Suma `nodeIds.length + memberIds.length` | `Selection.kind === 'multi'`; sin handler de propiedades |
| Múltiple | Desglose de nodos y miembros | Derivado | Bloqueado | objetos | Ambos | El payload solo contiene esos dos arrays | `Selection.nodeIds/memberIds` |
| Múltiple | Propiedades comunes / bulk edit | Avanzado | Bloqueado | - | Ambos | Fuera de alcance; no se infieren valores mixtos ni defaults | No existe handler de edición masiva |

Las cargas no forman parte de `multi`. La interfaz debe explicar el límite en texto, no presentar controles deshabilitados sin motivo.

## Nodo y apoyo

### Resumen, frecuentes y derivados

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nodo | ID | Derivado (resumen) | Bloqueado | - | Ambos | ID único en importación; no se renombra desde Inspector | `NodeModel.id`; tarjeta de selección |
| Nodo | X | Frecuente | Editable | longitud | Ambos | Draft finito; `validateProject` exige coordenada finita. La edición vigente pasa por reparación topológica. | `NodeModel.x` -> `updateNode('x')` -> `updateProject` -> `repairProjectTopology` |
| Nodo | Y | Frecuente | Editable | longitud | Ambos | Igual que X | `NodeModel.y` -> `updateNode('y')` -> `updateProject` -> `repairProjectTopology` |
| Apoyo (Nodo) | Tipo `none/pin/roller/fixed/custom` | Frecuente | Editable | - | Ambos | Select restringe enum. Cambio de tipo preserva `spring`; rodillo usa ángulo existente o 90; custom inicia restricciones false. | `SupportDefinition.type` -> `updateNode('supportType')` |
| Apoyo (rodillo) | Dirección normal `angleDeg` | Frecuente | Editable | `°` | Ambos, solo roller | Finitud en `validateProject`; fallback visual vigente 90 | `node.support.angleDeg` -> `updateNode('supportAngle')` |
| Apoyo (custom) | Restringir Ux | Frecuente | Editable | booleano | Ambos, solo custom | Select/toggle booleano; compatibilidad con desplazamientos prescritos en dominio | `support.restrainX` -> `updateNode('restrainX')` |
| Apoyo (custom) | Restringir Uy | Frecuente | Editable | booleano | Ambos, solo custom | Igual que Ux | `support.restrainY` -> `updateNode('restrainY')` |
| Apoyo (custom) | Restringir Rz | Frecuente | Editable | booleano | Ambos, solo custom | Igual que Ux | `support.restrainR` -> `updateNode('restrainR')` |
| Nodo | Articulación interna | Avanzado | Editable | booleano | Ambos | `validateProject` advierte poca conectividad/sin marcos y resuelve precedencia con resortes | `NodeModel.internalHinge` -> `updateNode('internalHinge')` |
| Nodo | Ux | Derivado | Bloqueado | longitud | Solo Completo tras análisis válido; Aula no lo muestra | Payload del solver; no se recalcula en UI | `analysis.nodeResults[].ux` |
| Nodo | Uy | Derivado | Bloqueado | longitud | Solo Completo tras análisis válido; Aula no lo muestra | Payload del solver | `analysis.nodeResults[].uy` |
| Nodo | Rz | Derivado | Bloqueado | `rad` | Solo Completo tras análisis válido; Aula no lo muestra | Payload del solver | `analysis.nodeResults[].rz` |
| Nodo/apoyo | Rx | Derivado | Bloqueado | fuerza | Completo tras análisis; Aula después de `resultsVisible` | Payload del solver | `analysis.nodeResults[].rx` |
| Nodo/apoyo | Ry | Derivado | Bloqueado | fuerza | Completo tras análisis; Aula después de `resultsVisible` | Payload del solver | `analysis.nodeResults[].ry` |
| Nodo/apoyo | Momento de reacción M | Derivado | Bloqueado | momento | Completo tras análisis; Aula después de `resultsVisible` | Payload del solver | `analysis.nodeResults[].rm` |

Toda edición de nodo conserva el handler `updateNode`. Si `repairProjectTopology` fusiona el nodo, la selección se redirige al ID conservado; la Fase 8 no cambia esa política ni la tolerancia geométrica.

### Propiedades avanzadas del apoyo

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Apoyo | kx | Avanzado | Editable | rigidez traslacional | Oculto/bloqueado en Aula; editable en Completo | Finito y `>= 0` en importación/dominio; ausencia se presenta como 0 sin persistir hasta dirty | `support.spring.kx` -> `updateNode('spring.kx')` |
| Apoyo | ky | Avanzado | Editable | rigidez traslacional | Aula / Completo igual que kx | Igual que kx | `support.spring.ky` -> `updateNode('spring.ky')` |
| Apoyo | kθ | Avanzado | Editable | rigidez rotacional | Aula / Completo igual que kx | Igual que kx | `support.spring.kr` -> `updateNode('spring.kr')` |
| Apoyo | k normal | Avanzado | Editable | rigidez traslacional | Aula / Completo igual que kx | Igual que kx; dirección legacy se valida si está presente | `support.spring.kNormal` -> `updateNode('spring.kNormal')` |
| Desplazamiento prescrito | ID | Derivado | Bloqueado | - | Solo Completo y apoyo distinto de `none` | ID único en importación/alta | `PrescribedDisplacement.id`; alta inline en `Inspector` |
| Desplazamiento prescrito | Caso | Avanzado | Editable | - | Solo Completo | Debe referenciar un `LoadCase` existente | `PrescribedDisplacement.caseId` -> `updatePrescribed` |
| Desplazamiento prescrito | Componente `ux/uy/rz/normal` | Avanzado | Editable | - | Solo Completo | Compatibilidad exacta con tipo/restricción del apoyo en `validateProject` | `PrescribedDisplacement.component` -> `updatePrescribed` |
| Desplazamiento prescrito | Valor traslacional | Avanzado | Editable | longitud | Solo Completo; ux/uy/normal | Debe ser finito; se factoriza por caso/combinación activa | `PrescribedDisplacement.value` -> `updatePrescribed` |
| Desplazamiento prescrito | Valor rotacional | Avanzado | Editable | `rad` | Solo Completo; rz | Debe ser finito | `PrescribedDisplacement.value` -> `updatePrescribed` |
| Desplazamiento prescrito | Añadir/eliminar | Avanzado | Editable (acción) | - | Solo Completo | Alta escoge un componente compatible inicial y valor 0; baja filtra por ID | callbacks de alta/baja -> `updateProject` |

El accordion de estas propiedades conserva su expansión como preferencia visual. Esa preferencia no entra a `ProjectModel` ni al historial físico.

## Miembro

### Resumen, frecuentes y derivados

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Miembro | ID | Derivado (resumen) | Bloqueado | - | Ambos | ID único; no se renombra desde Inspector | `MemberModel.id` |
| Miembro | Tipo `frame/truss/rigid` | Frecuente | Editable | - | Ambos | Select restringe enum; cambiar tipo no borra payload dormido | `MemberModel.type` -> `updateMember('type')` |
| Miembro | Nodo i | Derivado | Bloqueado | ID de nodo | Ambos | Referencia válida en importación/dominio | `MemberModel.i` |
| Miembro | Nodo j | Derivado | Bloqueado | ID de nodo | Ambos | Referencia válida y distinta de i | `MemberModel.j` |
| Miembro | Longitud L | Derivado | Bloqueado | longitud | Ambos | `hypot` de coordenadas; `validateProject` rechaza longitud nula/casi nula | `nodeMap` + `Math.hypot`; sin handler |
| Miembro | Ángulo | Derivado | Bloqueado | `°` | Ambos | `atan2` de coordenadas | `nodeMap` + `Math.atan2`; sin handler |
| Miembro deformable | E | Frecuente | Editable | módulo | Aula bloquea/oculta como automático; Completo editable | Finito y `> 0`; también se valida rango de E·A/E·I | `MemberModel.E` -> `updateMember('E')` |
| Miembro deformable | A | Frecuente | Editable | área | Aula bloquea/oculta; Completo editable | Finito y `> 0`; participa en E·A | `MemberModel.A` -> `updateMember('A')` |
| Miembro deformable | I | Frecuente | Editable | inercia | Aula bloquea/oculta; Completo editable | Finito y `> 0` requerido para frame; en truss se conserva por compatibilidad pero no gobierna la respuesta axial | `MemberModel.I` -> `updateMember('I')` |
| Frame | Liberación de momento i | Frecuente | Editable | booleano | Ambos | Solo compatible con frame; prevalece sobre resorte rotacional | `releases.iMoment` -> `updateMember('iMoment')` |
| Frame | Liberación de momento j | Frecuente | Editable | booleano | Ambos | Igual que extremo i | `releases.jMoment` -> `updateMember('jMoment')` |
| Miembro | N máx. | Derivado | Bloqueado | fuerza | Completo tras análisis; Aula después de `resultsVisible` | Payload del solver | `analysis.memberResults[].maxAxial` |
| Miembro | V máx. | Derivado | Bloqueado | fuerza | Completo tras análisis; Aula después de `resultsVisible` | Payload del solver | `analysis.memberResults[].maxShear` |
| Miembro | M máx. | Derivado | Bloqueado | momento | Completo tras análisis; Aula después de `resultsVisible` | Payload del solver | `analysis.memberResults[].maxMoment` |
| Vínculo rígido | Propiedades deformables | Derivado | Bloqueado / no aplica | - | Ambos | Compatibilidad cinemática exacta; no se asigna rigidez artificial | `MemberModel.type === 'rigid'`; nota existente |

### Propiedades avanzadas del miembro

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Miembro deformable | Densidad ρ | Avanzado | Editable | densidad | Oculto/bloqueado en Aula; Completo editable | Finita y `>= 0`; peso propio depende del factor del caso existente | `MemberModel.density` -> `updateMember('density')` |
| Frame | Teoría de viga | Avanzado | Editable | - | Solo Completo | Enum Euler-Bernoulli/Timoshenko; Timoshenko solo frame | `beamTheory` -> `updateMember('beamTheory')` |
| Frame Timoshenko | G | Avanzado | Editable | módulo | Solo Completo y Timoshenko | Finito y `> 0`; rango de G·As. Si falta, la UI vigente muestra E/2.6 sin persistir mientras esté pristine. | `MemberModel.G` -> `updateMember('G')` |
| Frame Timoshenko | As efectiva | Avanzado | Editable | área | Solo Completo y Timoshenko | Finita y `> 0`; incluye corrección de cortante. Fallback visual vigente A·5/6. | `MemberModel.shearArea` -> `updateMember('shearArea')` |
| Frame | Activar conexión semirrígida i | Avanzado | Editable | booleano visual | Solo Completo | Activar crea el default vigente `1e6`; desactivar elimina la propiedad | `rotationalSpringI !== undefined` -> `updateMember('useRotationalSpringI')` |
| Frame | kθ extremo i | Avanzado | Editable | rigidez rotacional | Solo Completo y activado | Finito y `>= 0`; warning si liberación/articulación prevalece | `rotationalSpringI` -> `updateMember('rotationalSpringI')` |
| Frame | Activar conexión semirrígida j | Avanzado | Editable | booleano visual | Solo Completo | Igual que extremo i | `rotationalSpringJ !== undefined` -> `updateMember('useRotationalSpringJ')` |
| Frame | kθ extremo j | Avanzado | Editable | rigidez rotacional | Solo Completo y activado | Igual que extremo i | `rotationalSpringJ` -> `updateMember('rotationalSpringJ')` |
| Frame | Offset rígido i | Avanzado | Editable | longitud | Solo Completo | Handler histórico aplica `max(0)`; dominio exige finito, no negativo, compatible y tramo flexible positivo | `rigidOffsetI` -> `updateMember('rigidOffsetI')` |
| Frame | Offset rígido j | Avanzado | Editable | longitud | Solo Completo | Igual que extremo i | `rigidOffsetJ` -> `updateMember('rigidOffsetJ')` |

### Temperatura y deformación inicial

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Efecto inicial | ID | Derivado | Bloqueado | - | Solo Completo | ID único | `MemberInitialEffect.id`; alta inline |
| Efecto inicial | Tipo `temperature/initial-strain` | Avanzado | Editable | - | Solo Completo | Select restringe enum; payload inactivo permanece almacenado | `MemberInitialEffect.type` -> `updateInitialEffect` |
| Efecto inicial | Caso | Avanzado | Editable | - | Solo Completo | Debe referenciar un caso existente | `caseId` -> `updateInitialEffect` |
| Temperatura | α | Avanzado | Editable | `1/°C` | Solo Completo | Finito y `>= 0`; handler histórico aplica `max(0)` | `alpha` -> `updateInitialEffect` |
| Temperatura | ΔT uniforme | Avanzado | Editable | `°C` | Solo Completo | Finito; conserva signo | `deltaT` -> `updateInitialEffect` |
| Temperatura en frame | Gradiente hacia +y local | Avanzado | Editable | `°C/m` | Solo Completo, solo frame | Finito; en truss la curvatura térmica es incompatible | `gradient` -> `updateInitialEffect` |
| Deformación inicial | ε0 axial | Avanzado | Editable | adimensional | Solo Completo | Finito; positivo alarga según contrato existente | `axialStrain` -> `updateInitialEffect` |
| Deformación inicial en frame | κ0 | Avanzado | Editable | `1/m` | Solo Completo, solo frame | Finito; signo vigente dθ/dx; incompatible con truss | `curvature` -> `updateInitialEffect` |
| Efecto inicial | Añadir/eliminar | Avanzado | Editable (acción) | - | Solo Completo | Alta conserva defaults vigentes `temperature`, α `1.2e-5`, ΔT/gradiente 0 | callbacks de alta/baja -> `updateProject` |

## Carga nodal: puntual, momento o mixta

Una carga nodal **no tiene selector de tipo**. `fx`, `fy` y `mz` pueden ser simultáneamente distintos de cero. La representación del canvas puede priorizar una flecha de fuerza, pero el Inspector no debe ocultar `mz` ni dividir el registro.

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Carga nodal | ID | Derivado (resumen) | Bloqueado | - | Ambos | ID único | `NodalLoad.id` |
| Carga nodal | Nodo destino | Derivado | Bloqueado | ID de nodo | Ambos | Referencia existente | `NodalLoad.nodeId` |
| Carga nodal | Composición Fx/Fy/Mz | Derivado (resumen) | Bloqueado | - | Ambos | Puede ser fuerza, momento o mixta; no normalizar componentes | Derivada del mismo `NodalLoad` |
| Carga nodal | Caso | Frecuente | Editable | - | Ambos | Debe referenciar un caso existente | `NodalLoad.caseId` -> `updateNodalLoad` |
| Carga nodal | Horizontal Fx | Frecuente | Editable | fuerza | Ambos | Finito; signo invierte dirección | `NodalLoad.fx` -> `updateNodalLoad('fx')` |
| Carga nodal | Vertical Fy | Frecuente | Editable | fuerza | Ambos | Finito; signo invierte dirección | `NodalLoad.fy` -> `updateNodalLoad('fy')` |
| Carga nodal | Momento Mz | Frecuente | Editable | momento | Ambos | Finito; si es no nulo la rotación debe participar o estar restringida | `NodalLoad.mz` -> `updateNodalLoad('mz')` |
| Carga nodal | Eliminar carga | Frecuente | Editable (acción) | - | Ambos | Filtra por ID; undo existente | `deleteLoad('nodal', id)` -> `updateProject` |

## Cargas de miembro

### Propiedades comunes

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Carga de miembro | ID | Derivado (resumen) | Bloqueado | - | Ambos | ID único | `MemberLoad.id` |
| Carga de miembro | Miembro destino | Derivado | Bloqueado | ID de miembro | Ambos | Referencia existente; rigid/truss no admiten carga intermedia | `MemberLoad.memberId` |
| Carga de miembro | Tipo `distributed/point/moment` | Frecuente | Editable | - | Ambos | Select restringe enum; cambiarlo no borra payload inactivo | `MemberLoad.type` -> `updateMemberLoad('type')` |
| Carga de miembro | Caso | Frecuente | Editable | - | Ambos | Debe referenciar un caso existente | `caseId` -> `updateMemberLoad` |
| Carga de miembro | Sistema global/local | Frecuente | Editable | - | Ambos | Enum vigente; global usa X/Y y local los ejes del miembro | `coordinateSystem` -> `updateMemberLoad` |
| Carga de miembro | Eliminar carga | Frecuente | Editable (acción) | - | Ambos | Filtra por ID; undo existente | `deleteLoad('member', id)` -> `updateProject` |

### Carga distribuida

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Distribuida | Base `real/horizontal/vertical` | Frecuente | Editable | - | Ambos | Enum; proyección elegida no puede ser nula para la geometría | `lengthBasis` -> `updateMemberLoad` |
| Distribuida | Desde | Frecuente | Editable | `x/L`, rótulo histórico `L` | Ambos | `0 <= start < end <= 1`; handler histórico clampa a `[0,1]` | `start` -> `updateMemberLoad` |
| Distribuida | Hasta | Frecuente | Editable | `x/L`, rótulo histórico `L` | Ambos | Igual que Desde | `end` -> `updateMemberLoad` |
| Distribuida | qx al inicio | Frecuente | Editable | fuerza distribuida | Ambos | Finito; signo/ejes vigentes | `qxStart` -> `updateMemberLoad` |
| Distribuida | qx al final | Frecuente | Editable | fuerza distribuida | Ambos | Finito | `qxEnd` -> `updateMemberLoad` |
| Distribuida | qy al inicio | Frecuente | Editable | fuerza distribuida | Ambos | Finito | `qyStart` -> `updateMemberLoad` |
| Distribuida | qy al final | Frecuente | Editable | fuerza distribuida | Ambos | Finito | `qyEnd` -> `updateMemberLoad` |

`normalizeProject` intercambia inicio/fin y las intensidades asociadas si un archivo importado llega invertido. Esa canonicalización es de importación; el formulario usa validación inline y no reordena silenciosamente un draft.

### Carga puntual de miembro

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Puntual de miembro | Posición | Frecuente | Editable | `x/L`, rótulo histórico `L` | Ambos | Finita y en `[0,1]`; fallback visual vigente 0.5 y clamp histórico | `position` -> `updateMemberLoad` |
| Puntual de miembro | Fuerza X | Frecuente | Editable | fuerza | Ambos | Finita; respeta sistema global/local y signo | `px` -> `updateMemberLoad` |
| Puntual de miembro | Fuerza Y | Frecuente | Editable | fuerza | Ambos | Finita; respeta sistema global/local y signo | `py` -> `updateMemberLoad` |

### Momento de miembro

| Entidad | Propiedad | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Momento de miembro | Posición | Frecuente | Editable | `x/L`, rótulo histórico `L` | Ambos | Finita y en `[0,1]`; fallback visual vigente 0.5 y clamp histórico | `position` -> `updateMemberLoad` |
| Momento de miembro | M | Frecuente | Editable | momento | Ambos | Finito; positivo antihorario según contrato | `moment` -> `updateMemberLoad` |

## Pestañas globales que se conservan

La reorganización contextual no elimina las pestañas Cargas y Vista. Sus controles siguen usando los contratos existentes.

| Contexto | Propiedad/acción | Nivel | Estado | Unidad | Aula / Completo | Validación o normalización existente | Fuente / handler actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cargas | Elegir herramienta puntual/distribuida/momento | Frecuente | Editable (acción) | - | Ambas; herramientas filtradas por el flujo existente | Registry/handlers de herramienta vigentes | `LoadsPanel` -> `setActiveTool` |
| Caso de carga | ID | Derivado | Bloqueado | - | Ambos | ID único | `LoadCase.id` |
| Caso de carga | Activo | Frecuente | Editable | booleano | Ambos | Al menos un caso activo recomendado por `validateProject` | callback inline -> `updateProject` |
| Caso de carga | Nombre | Frecuente | Editable | - | Ambos | String vigente | callback inline -> `updateProject` |
| Caso de carga | Categoría | Derivado | Bloqueado en UI actual | - | Ambos | Enum tipado; se muestra como texto | `LoadCase.category` |
| Combinación | Selección para analizar | Frecuente | Editable (contexto) | - | Ambos | Debe referenciar combinación existente | `setSelectedCombinationId` |
| Combinación | Factores por caso | Avanzado | Editable | adimensional | Ambos | Finitos; referencias de caso existentes | callback inline -> `updateProject` |
| Combinación | Fuente/jurisdicción/edición | Derivado | Bloqueado | - | Ambos cuando existe | Metadatos informativos | `LoadCombination` en `LoadsPanel` |
| Vista | Modo Aula/Completo | Frecuente | Editable (vista) | - | Selector global | Enum existente | `DisplayPanel.setSetting` -> `updateProjectView` |
| Vista | Grid, snap, gridSize, labels, ejes, cotas y cargas | Frecuente | Editable (vista) | gridSize: longitud | Ambos | gridSize conserva mínimo vigente `1e-6` base | `DisplayPanel.setSetting` -> `updateProjectView` |
| Vista | Snap targets y filtros de selección | Avanzado | Editable (vista) | - | Ambos | Booleanos existentes | `DisplayPanel.setSetting` -> `updateProjectView` |
| Resultados (vista) | Overlay, escala común/individual, factor, deformada y lado | Avanzado | Editable (vista) | factores adimensionales | Ambos | Mínimos visuales vigentes; no cambian resultados | `DisplayPanel.setSetting` -> `updateProjectView` |
| Colores semánticos | Leyenda N/V/M/cargas/cotas/ejes | Derivado | Bloqueado | - | Ambos | Tokens visuales; no altera signos | `DisplayPanel` |

`updateProjectView` no crea historial físico ni invalida el análisis. El selector de unidades permanece fuera de los handlers físicos y solo cambia presentación.

## Campos tipados o legacy no expuestos

Estos campos no se convierten en nuevos controles en Fase 8. Se conservan en el modelo para compatibilidad y no se borran al cambiar variante.

| Fuente | Campo no expuesto/editable | Tratamiento |
| --- | --- | --- |
| `SupportDefinition` | `spring.angleDeg` | Tipado, normalizado y validado cuando corresponde; no se inventa un editor nuevo. |
| `SupportDefinition` | `prescribed.{ux,uy,rz,normal}` | Ruta legacy sin caso. El Inspector moderno usa `ProjectModel.prescribedDisplacements[]`; el handler legacy existente no justifica exponerla. |
| `MemberModel` | `label` | Se conserva/importa, pero el ID visible no se reemplaza ni se renombra. |
| `NodeResult` | `supportNormalReaction`, `supportTangentialReaction` | Permanecen en payload/resultados; no se agregan como campos editables. |
| `LoadCase` | `selfWeightFactor` y edición de `category` | `category` se muestra; ninguno se vuelve control nuevo en esta fase. |
| `LoadCombination` | `sourceUrl`, `stateLimit`, `reviewedAt`; edición de nombre/metadatos | Se preservan; fuente/jurisdicción/edición continúan de solo lectura cuando existen. |
| IDs/asociaciones | IDs de nodo/miembro/carga/efecto, `member.i/j`, `NodalLoad.nodeId`, `MemberLoad.memberId`, `PrescribedDisplacement.nodeId`, `MemberInitialEffect.memberId` | Bloqueados; cambiar contratos o referencias está fuera de alcance. |
| `MemberLoad` | Payload inactivo de otra variante | `start/end/lengthBasis/q*`, `position/px/py` o `moment` permanecen almacenados y ocultos según `type`; cambiar tipo no los limpia. |
| `MemberModel` | Propiedades no aplicables al tipo activo | El handler de tipo conserva material, teoría, releases, resortes y offsets dormidos; la UI los oculta/bloquea por aplicabilidad. |
| `MemberInitialEffect` | Payload inactivo de temperatura o deformación | Cambiar `type` no borra los campos de la otra variante. |

## Validación, normalización e historial

| Capa existente | Responsabilidad que se conserva |
| --- | --- |
| `InspectorNumericField` | Buffer, sintaxis decimal/científica, finitud, dirty, vacío, error y helper accesible. No contiene física. |
| Handlers de `Inspector` | Aplican conversiones con `fromDisplay` y mutan la propiedad vigente mediante `updateProject`. |
| `validateProject` en `src/engine/solver.ts` | Reglas de dominio: positividad, compatibilidad, referencias, intervalo, longitud flexible, tipo de elemento, rotación participante y demás checks físicos. |
| `normalizeProject` en `src/data/migrate.ts` | Validación/canonicalización en importación. No se ejecuta en cada blur. |
| `updateProject` en `ProjectContext` | Clone exacto, comparación, una entrada undo, limpieza de redo e invalidación de análisis solo cuando el modelo realmente cambia. |
| `updateProjectView` | Cambios de presentación sin historial físico ni invalidación de resultados. |

La validación inline reutiliza las mismas condiciones/mensajes de dominio y no crea defaults nuevos. Los clamps históricos de offsets, α y ratios permanecen como defensa del handler; la UI evita el commit inválido en lugar de cambiar silenciosamente el draft.

## Aula y Completo

| Familia | Aula | Completo |
| --- | --- | --- |
| Nodo | X/Y, apoyo e internal hinge editables; sin resortes ni desplazamientos por caso. | Todas las propiedades del nodo y apoyo. |
| Resultados de nodo | Solo Rx/Ry/M después del reveal educativo. | Ux/Uy/Rz/Rx/Ry/M tras análisis válido. |
| Miembro | Tipo, geometría, releases y resultados revelados; E/A/I usan valores automáticos almacenados y se explican como bloqueados. | Material, sección, Timoshenko, efectos iniciales, conexiones semirrígidas y offsets accesibles. |
| Vínculo rígido | Nota de compatibilidad exacta; sin propiedades deformables. | Igual. |
| Cargas | Edición completa de carga nodal y las tres variantes de miembro. | Igual. |
| Ninguna selección | Empty state más guía de Aula. | Empty state. |
| Múltiple | Resumen sin bulk edit. | Igual. |

Ocultar una propiedad avanzada en Aula no la elimina ni cambia su valor. Cambiar Aula/Completo no muta el modelo físico.

## Superficies responsive y estado del accordion

- Desktop: panel lateral persistente.
- Tablet: drawer con el mismo inventario y el mismo orden.
- Móvil: bottom sheet con safe area y último campo alcanzable con teclado abierto.
- La superficie cambia composición, no disponibilidad de propiedades por entidad.
- Drawer y bottom sheet aplican focus trap, Escape, fondo inerte y retorno al invocador.
- La expansión de Propiedades avanzadas persiste por familia de entidad, no por valor físico ni por ID individual.
- Cambiar selección resincroniza todos los drafts mediante ID/reset key; el estado abierto/cerrado del accordion puede persistir sin mostrar datos del elemento anterior.

## Cobertura de prueba derivada del inventario

- Ninguna, nodo libre, apoyo pin/roller/custom/fixed, miembro frame/truss/rigid, carga nodal mixta, puntual de miembro, distribuida, momento y multi.
- Aula y Completo con cada grupo permitido/bloqueado.
- Campo editable, derivado, bloqueado, opcional ausente y fallback pristine.
- Unidades visibles en los cuatro sistemas; rotación, temperatura, strain y ratio con sus rótulos actuales.
- Vacío, inválido, no finito, restricciones locales configuradas y feedback inline de `ValidationIssue` existente para reglas físicas o cruzadas como `start < end`.
- Cambio de selección con draft pendiente; alta/baja de efectos; cambio de tipo sin pérdida de payload inactivo.
- Commit válido, commit equivalente, undo y redo exactos.
- Accordion persistente; panel, drawer y bottom sheet; Light/Dark; foco inicial, trap, Escape y retorno.
- Ausencia de edición masiva en `multi` y ausencia de nuevos controles para campos legacy.

## Frontera de dominio que no se modifica

La Fase 8 llama contratos existentes, pero no edita:

- Todo `src/engine/**`, incluidos solver, formulación, unidades, signos, resultados y tolerancias.
- `src/workers/**` y protocolos de worker.
- `src/types.ts`: IDs, `Selection`, entidades y payloads.
- `src/store/ProjectContext.tsx`: historial, persistencia, análisis y handlers de actualización.
- `src/data/modelOperations.ts`: topología, merge/split y tolerancias geométricas.
- `src/data/migrate.ts`, `src/data/projectStorage.ts` y `src/data/defaultProject.ts`.
- `src/components/StructuralCanvas.tsx`, `src/components/canvasInteraction.ts` y geometría de canvas.
- `src/utils/snapping.ts`, `src/utils/selectionGeometry.ts` y módulos portable/importación/exportación.

Los cambios de Fase 8 se limitan a componentes y estilos del Inspector, organización visual, buffers de formulario, accesibilidad y pruebas UI.
