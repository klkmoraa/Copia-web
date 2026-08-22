# CRI-12E · Backlog final de implementación, ordenado

**Clasificación:** `AUDIT/TEMPORARY`

Clasificación final de las 18 issues de CRI-88 (CRI-89…CRI-106), verificada contra Linear y contra `04-dependency-map.md` en este gate. `READY` = sin `blockedBy` pendiente, ejecutable hoy. `PARALLEL_SAFE` = subconjunto de `READY` sin conflicto de archivo entre sí. `BLOCKED` = tiene al menos un `blockedBy` `HARD` sin cerrar. `DEFERRED` = decisión de producto ya tomada de no crear issue todavía (rechazada, diferida, o abierta sin acotar).

## Primera issue realmente ejecutable después de CRI-12

**CRI-89 — Shell adaptativo, resolutor de composición X2/M1/K0.** Sin `blockedBy`, prioridad `Urgent`, raíz del camino crítico (`CRI-89 → CRI-94 → CRI-96 → CRI-97`). Ningún otro slice puede construirse de forma definitiva sin la clase real: once issues dependen de ella directa o transitivamente.

## READY — sin bloqueo, ejecutables hoy mismo

| Issue | Prioridad | Por qué está lista |
|---|---|---|
| **CRI-89** | Urgent | Fundación; cero dependencias |
| **CRI-90** | High | Sólo `src/design-system/**`, disjunto de todo lo demás |
| **CRI-91** | Urgent | Sólo `brand/**` + `tokens.css` + Component Lab, disjunto de `src/features/**` |
| **CRI-92** | High | Spike de sólo lectura; su veredicto bloquea sólo la mitad `view` de CRI-99 |
| **CRI-93** | Medium | Spike de sólo medición; no bloquea nada de forma dura |

## PARALLEL_SAFE — el frente de día 1, sin conflicto de archivo entre sí

**CRI-89 · CRI-90 · CRI-91 · CRI-92 · CRI-93** — cinco pistas simultáneas, ficheros y contratos disjuntos, confirmado en `04-dependency-map.md` §3. Ninguna requiere que otra del grupo termine primero.

**Nota de contención, no de bloqueo formal**: `src/features/workspace/WorkspaceShell.tsx` lo tocan seis issues (CRI-89, 94, 95, 99, 101, 102) y `src/features/results/ResultsPanel.tsx` lo tocan cuatro (CRI-89, 95, 100, 101). No ejecutar dos slices que toquen el mismo archivo en paralelo aunque no haya `blockedBy` formal entre ellos — el orden entre CRI-100 y CRI-101 sobre `ResultsPanel.tsx` **sí** es estricto (ver tabla BLOCKED).

## BLOCKED — con al menos un `blockedBy` HARD pendiente

| Issue | blockedBy | Se desbloquea cuando… |
|---|---|---|
| **CRI-94** | CRI-89 | CRI-89 cierra |
| **CRI-95** | CRI-89 | CRI-89 cierra |
| **CRI-96** | CRI-89, CRI-94 | CRI-89 y CRI-94 cierran |
| **CRI-97** | CRI-89, CRI-94, CRI-96 | los tres cierran |
| **CRI-98** | CRI-89, CRI-90 | ambos cierran |
| **CRI-99** | CRI-89, CRI-94, **CRI-92** | los tres cierran — el bloqueo con CRI-92 es el único que nace de un gate del repositorio (`protected-baseline.sha256` sobre `src/types.ts`), no de una decisión de diseño |
| **CRI-100** | CRI-89, CRI-94, CRI-95 | los tres cierran |
| **CRI-101** | CRI-100, CRI-90, CRI-91 | los tres cierran — construir antes sobre paleta provisional obligaría a repetir el QA de Día/Noche completo |
| **CRI-102** | CRI-94, CRI-90 | ambos cierran |
| **CRI-103** | CRI-89 | CRI-89 cierra |
| **CRI-104** | CRI-90, CRI-91 | ambos cierran |
| **CRI-105** | CRI-91, CRI-90 | ambos cierran — la escala de radios la fija el Brandbook, aplicarla antes sería inventarla |
| **CRI-106** | CRI-91 | CRI-91 cierra — medir sobre lima produciría un resultado que caduca al entrar la menta |

### Capas de desbloqueo, en orden

1. **Capa 0** (día 1): CRI-89, CRI-90, CRI-91, CRI-92, CRI-93 — `READY`.
2. **Capa 1** (tras CRI-89): CRI-94, CRI-95 — paralelas entre sí, con la nota de contención de `WorkspaceShell.tsx`.
3. **Capa 2** (tras CRI-89+CRI-94): CRI-96, luego CRI-97.
4. **Capa 3** (tras capas 0-2, según su propia fila): CRI-98, CRI-99, CRI-100, CRI-102, CRI-103, CRI-104 — razonablemente disjuntas entre sí.
5. **Capa 3→4**: CRI-101 (tras CRI-100+90+91).
6. **Capa 4** (acabado): CRI-105, CRI-106.

## DEFERRED — decisión de producto ya tomada de no crear issue

| Tema | Disposición | Fuente |
|---|---|---|
| Esencial/Completa | **Rechazada.** No se crea issue; reabrirla exige nueva evidencia de negocio fuera de CRI-12. | `02-ux-decision-matrix.md` #1 |
| Marco de selección direccional (ABIERTA-3) | **Diferido.** Requiere test de discoverability no ejecutado. | `02-ux-decision-matrix.md` #4 |
| Serif editorial para titulares | **Abierta, sin acotar.** Dos límites duros ya fijados (nunca en datos/Datasheet; requiere resolver la entrega local-first antes). | `03-visual-direction-record.md` V-06 |
| Tarjetas en Datasheet y tablas densas | **Petición registrada, no decisión.** Ejecutarla reabriría D-11/D-03, arquitectura cerrada. | `03-visual-direction-record.md` V-10 |
| Migración de `settings.show*` fuera del schema | **Depende del veredicto de CRI-92** (que sí está `READY`). La migración en sí, si procede, es una issue posterior no creada todavía — exige plan de reversión propio y autorización explícita del propietario para refrescar `protected-baseline.sha256`. | `04-migration-strategy.md` §8; CRI-92 |
| Aula vNext | Fuera de alcance de CRI-88 en su totalidad. | CRI-88 (épico), sección "Qué NO entra" |
| Productización de Space3D | Fuera de alcance; D-15 congelado. | CRI-88 (épico), sección "Qué NO entra" |
| 8 escenarios de discoverability | Riesgo aceptado; seguimiento post-lanzamiento, no issue de CRI-88. | `02-ux-decision-matrix.md` #8 |
