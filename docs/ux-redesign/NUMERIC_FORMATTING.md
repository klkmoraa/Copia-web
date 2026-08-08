# Formato numérico del Inspector - Fase 8

## Propósito

Este documento define el contrato de presentación y edición numérica del Inspector. Su objetivo es mostrar precisión útil sin modificar la precisión almacenada, mantener visibles las unidades y evitar que un estado intermedio del formulario se convierta en un cambio físico accidental.

La regla principal es:

> El texto presentado nunca es la fuente del valor persistido. Solo una edición explícita, válida y distinta puede invocar el handler existente.

La Fase 8 no cambia unidades internas, factores de conversión, tolerancias del solver, convenciones de signo, defaults físicos ni validaciones de dominio.

## Tres representaciones separadas

| Capa | Tipo | Responsabilidad | Puede persistirse |
| --- | --- | --- | --- |
| `storedValue` | `number` en unidades base | Valor autoritativo de `ProjectModel` o `AnalysisResult`. Conserva todos los bits disponibles. | Sí, mediante los handlers existentes. |
| `displayValue` | `number` en la unidad activa | Resultado de `toDisplay(storedValue, units, quantity)` o de un cálculo derivado de solo lectura. Todavía no está redondeado. | No. |
| `draftText` | `string` local | Texto exacto que el usuario está escribiendo; puede estar vacío o ser temporalmente inválido. | No. |

La lectura usa `formatInspectorNumber(displayValue)`. Al entrar en edición se usa `serializeInspectorNumber(displayValue)`, que produce la representación decimal más corta con round-trip de JavaScript. Si la persona confirma un cambio, `parseInspectorNumber(draftText)` entrega el valor en unidades visibles y el padre aplica `fromDisplay` antes de llamar al handler existente.

Consecuencias obligatorias:

- El valor redondeado de lectura nunca vuelve a `ProjectModel`.
- Enfocar y desenfocar sin editar no llama `onCommit`.
- Escribir una representación equivalente, por ejemplo `1.000` cuando el valor visible es `1`, tampoco llama `onCommit`.
- Un campo vacío no se transforma en `0`.
- Un valor opcional mostrado mediante un fallback como `?? 0` o `?? 0.5` no se crea en el modelo mientras el campo permanezca pristine.
- Cambiar selección, subentidad, unidad o valor externo resincroniza mediante `resetKey`/`value` y descarta el draft anterior; nunca se muestra un formulario stale.

## Regla de lectura

El contrato de `formatInspectorNumber` es independiente del locale:

- 6 cifras significativas por defecto.
- Sin separadores de miles.
- Punto (`.`) como separador decimal técnico.
- Sin ceros finales cosméticos.
- Notación científica si `0 < abs(value) < 1e-4`.
- Notación científica si `abs(value) >= 1e7`.
- Exponente normalizado con signo positivo explícito: `1e+7`, `1.25e-5`.
- `0` y `-0` se presentan como `0`.
- `NaN`, `Infinity` y `-Infinity` se presentan como `—` en lectura y no son entradas válidas.

Se permite `maximumFractionDigits` cuando el contexto tiene una resolución visual útil, y `significantDigits` cuando una lectura técnica necesita otra cantidad de cifras. Estas opciones solo cambian el texto. Por defecto no se aplica una tolerancia física de cero: todo número finito no nulo se conserva y los números pequeños pasan a notación científica. Si un override contextual redondea visualmente a cero, enfocar el campo vuelve a revelar la representación completa y el valor almacenado no cambia.

Ejemplos normativos:

| Valor visible completo | Lectura por defecto | Observación |
| ---: | ---: | --- |
| `12.34001` | `12.34` | Elimina ceros no significativos. |
| `0.0001234567` | `0.000123457` | Permanece decimal en el límite permitido. |
| `0.00001` | `1e-5` | Extremo pequeño. |
| `10000000` | `1e+7` | Extremo grande. |
| `123456789` | `1.23457e+8` | 6 cifras significativas. |
| `-0` | `0` | Normalización exclusivamente visual. |
| `NaN` | `—` | Nunca se ofrece como valor editable válido. |

## Precisión por contexto

| Contexto | Propiedades | Presentación recomendada | Unidad |
| --- | --- | --- | --- |
| Geometría editable | X, Y, offsets, desplazamientos prescritos | 6 cifras significativas; científica en extremos | Unidad activa de longitud |
| Geometría derivada | Longitud | 6 cifras significativas | Unidad activa de longitud |
| Ángulos | Ángulo del miembro, normal del rodillo | Hasta 2 decimales en lectura; edición exacta al foco | `°` |
| Posición normalizada | inicio, fin, posición | Hasta 6 cifras significativas; validar `0 <= x/L <= 1` | `x/L` o `L` como rótulo histórico, nunca unidad de longitud |
| Acciones | Fx, Fy, Mz, px, py, M, qx, qy | 6 cifras significativas; científica en extremos | Fuerza, momento o fuerza distribuida activa |
| Material y sección | E, G, A, As, I, densidad | 6 cifras significativas; científica en extremos | Unidad activa correspondiente |
| Rigideces | kx, ky, k normal, kθ | 6 cifras significativas; científica en extremos | Unidad activa de rigidez |
| Temperatura y deformación inicial | α, ΔT, gradiente, ε0, κ0 | 6 cifras significativas; científica cuando aplique | Unidades técnicas actuales, sin conversión nueva |
| Rotación | Rz y desplazamiento prescrito rz | Científica para valores pequeños | `rad` |
| Resultados rápidos | desplazamientos, reacciones, N/V/M máximos | 6 cifras significativas salvo override visual explícito | Unidad activa correspondiente |

La precisión contextual no autoriza a truncar el valor almacenado ni a definir una nueva tolerancia de ingeniería.

## Entrada, foco y confirmación

`InspectorNumericField` mantiene un buffer local y un indicador `dirty`.

| Evento | Comportamiento obligatorio |
| --- | --- |
| Reposo | Mostrar `formatInspectorNumber(displayValue)` y la unidad por separado. |
| Focus | Si el campo no está dirty, mostrar `serializeInspectorNumber(displayValue)` sin redondeo de presentación. |
| Change | Conservar exactamente el texto recibido y marcar dirty; no mutar el proyecto. |
| Blur sin cambios | Volver a la lectura compacta; no llamar `onCommit`. |
| Blur con número válido distinto | Ejecutar la validación UI existente, llamar una sola vez `onCommit(parsedDisplay)` y volver a lectura compacta. |
| Blur con número equivalente | Limpiar dirty y volver a lectura; no crear entrada de undo. |
| Blur vacío | Mantener el draft vacío, mostrar `Este campo no puede quedar vacío.` y conservar `storedValue`. |
| Blur inválido o no finito | Mantener el draft, mostrar error inline y conservar `storedValue`. |
| Enter | Prevenir submit accidental, ejecutar blur y la misma ruta de confirmación. Si hay error no se persiste. |
| Escape | Prevenir y detener propagación, restaurar la serialización exacta del valor vigente, limpiar dirty/error y conservar el foco. No cerrar el Inspector. |
| Cambio de `resetKey` o `value` | Descartar el draft, limpiar error y sincronizar con la nueva selección/valor. |

El `resetKey` debe identificar al menos entidad, ID y propiedad. Los campos que pasan por `toDisplay`/`fromDisplay` añaden además el sistema de unidades; las magnitudes técnicas literales (`°`, `rad`, temperatura, strain y ratios) no cambian con ese sistema. En listas también se incluye el ID del efecto o desplazamiento.

### Sintaxis aceptada

`parseInspectorNumber` acepta números decimales y científicos finitos con punto decimal:

- Válidos: `12`, `-12.5`, `+4`, `.5`, `12.`, `-1.25e-3`, `2E+6`.
- Vacíos: `''` y espacios; reciben un error distinto del formato inválido.
- Inválidos: `1e`, `1,25`, `0x10`, `Infinity`, texto con unidad y separadores de miles.
- Fuera de rango numérico: por ejemplo `1e400`; se rechaza como no finito.

La unidad nunca se escribe dentro del input. Se presenta como sufijo visible y se enlaza con `aria-describedby`.

## Dirty, validación y normalización

La capa de formato valida sintaxis y finitud. La prop `validate` proyecta condiciones locales ya aplicadas por el handler, como `value >= 0` o `0 <= x/L <= 1`, con helper/error inline. Las reglas físicas y cruzadas siguen siendo propiedad de `validateProject`; sus `ValidationIssue` se muestran inline para el objeto seleccionado después de analizar, sin reimplementarlas en el formulario.

Reglas de integración:

- No usar `Number('')`, porque devuelve `0`.
- No corregir silenciosamente un draft inválido.
- No reordenar inicio/fin ni cambiar signos durante la edición.
- Los clamps históricos de handlers quedan como defensa. Cuando su condición es local al campo, el Inspector la muestra antes del commit.
- La regla cruzada de carga distribuida sigue siendo `0 <= start < end <= 1`, propiedad de `validateProject`; el formulario muestra helper preventivo y el Inspector proyecta el issue vigente del análisis, sin duplicar esa regla.
- La canonicalización de intervalos invertidos en `normalizeProject` pertenece solo a la frontera de importación; no es una regla de tecleo.
- Selects y toggles siguen restringiendo enums/booleanos existentes.
- El resultado de una confirmación válida pasa por `updateProject`, por lo que mantiene una sola entrada de undo, limpia redo e invalida el análisis como hasta ahora.

## Unidades visibles y conversión no destructiva

La fuente única de factores y rótulos continúa siendo `src/engine/units.ts`. El Inspector no copia factores ni hace conversiones propias.

| Cantidad | Base interna | `kN-m` | `N-mm` | `kgf-m` | `kip-ft` |
| --- | --- | --- | --- | --- | --- |
| Longitud | `m` | `m` | `mm` | `m` | `ft` |
| Fuerza | `kN` | `kN` | `N` | `kgf` | `kip` |
| Momento | `kN·m` | `kN·m` | `N·mm` | `kgf·m` | `kip·ft` |
| Fuerza distribuida | `kN/m` | `kN/m` | `N/mm` | `kgf/m` | `kip/ft` |
| Módulo elástico/cortante | `kN/m²` | `MPa` | `MPa` | `kgf/cm²` | `ksi` |
| Área | `m²` | `m²` | `mm²` | `cm²` | `in²` |
| Inercia | `m⁴` | `m⁴` | `mm⁴` | `cm⁴` | `in⁴` |
| Rigidez traslacional | `kN/m` | `kN/m` | `N/mm` | `kgf/m` | `kip/ft` |
| Rigidez rotacional | `kN·m/rad` | `kN·m/rad` | `N·mm/rad` | `kgf·m/rad` | `kip·ft/rad` |
| Densidad | `kg/m³` | `kg/m³` | `kg/m³` | `kg/m³` | `lb/ft³` |

Unidades actuales fuera de `UnitQuantity` se conservan literalmente: `°`, `rad`, `1/°C`, `°C`, `°C/m`, adimensional y `1/m`. La Fase 8 solo mejora su visibilidad; no introduce conversiones de temperatura, gradiente, deformación o curvatura.

### Mismo valor almacenado en los cuatro sistemas

El siguiente ejemplo parte siempre de los mismos valores internos: longitud `1.23456789 m`, fuerza `-12.3456789 kN` y momento `0.000012345 kN·m`.

| Sistema visible | Longitud | Fuerza | Momento |
| --- | ---: | ---: | ---: |
| `kN-m` | `1.23457 m` | `-12.3457 kN` | `1.2345e-5 kN·m` |
| `N-mm` | `1234.57 mm` | `-12345.7 N` | `12.345 N·mm` |
| `kgf-m` | `1.23457 m` | `-1258.91 kgf` | `0.00125884 kgf·m` |
| `kip-ft` | `4.05042 ft` | `-2.77542 kip` | `9.1052e-6 kip·ft` |

Cambiar el sistema solo recalcula `displayValue` y el rótulo. Los tres valores internos del ejemplo permanecen idénticos.

## Campos bloqueados, unidades y accesibilidad

- Un valor derivado no se representa como un input editable.
- Si una presentación necesita conservar la forma de campo, `lockedReason` lo deshabilita y explica por qué está bloqueado.
- Editable/bloqueado no depende solo del color: se usa texto, icono y semántica disabled/read-only.
- Unidad, helper, motivo de bloqueo y error tienen IDs propios y se agregan a `aria-describedby`.
- El error activo usa `aria-invalid`, `aria-errormessage` y un mensaje con `role="alert"`.
- El foco visible, el orden de tabulación y el tamaño táctil no cambian con la presencia de una unidad o error.
- Un error no elimina el texto ingresado ni mueve el foco de forma inesperada.

## Pruebas de aceptación

| Nivel | Casos mínimos |
| --- | --- |
| Formato puro | 6 cifras significativas, override contextual, umbrales `1e-4`/`1e7`, extremos, `0`, `-0`, `NaN`, unidad opcional y ceros finales. |
| Serialización/parser | Round-trip de `0`, fracciones, negativos, `Number.MIN_VALUE` y `Number.MAX_VALUE`; vacío, parcial científico, coma, hexadecimal, infinito y overflow rechazados. |
| Campo | Focus revela precisión completa; blur pristine no confirma; Enter confirma una vez; equivalente textual no confirma; Escape restaura y no cierra; reset por selección/valor elimina stale draft. |
| Error inline | Vacío, sintaxis inválida, no finito y restricciones locales configuradas (`>= 0`, `0..1`); stored value y undo permanecen intactos. Los issues físicos/cruzados provienen del análisis vigente. |
| Unidades | Unidad visible/asociada; `toDisplay`/`fromDisplay` en las 10 cantidades y los 4 sistemas; cambio de sistema no modifica el valor interno. |
| Integración Inspector | Nodo, apoyo, miembro, carga nodal mixta, puntual, distribuida y momento; edición válida crea una entrada undo y redo restaura exactamente. |
| Precisión | Focus/blur sin cambio produce cero llamadas al handler; una lectura compacta nunca se persiste; valores extremos sobreviven selección y cambio de unidad. |
| Accesibilidad | `aria-describedby`, `aria-invalid`, `aria-errormessage`, motivo de lock, orden de teclado y mensaje de error anunciado. |

Archivos de prueba de la capa presentacional:

- `src/components/inspector/numericFormatting.test.ts`
- `src/components/inspector/InspectorNumericField.test.tsx`
- Pruebas de integración del Inspector para selección, validación, unidades, undo/redo y responsive.

Las pruebas existentes de `src/engine/units.test.ts` continúan siendo la guardia de conversión y no se modifican para introducir reglas de interfaz.

## Frontera protegida

Este contrato se implementa encima de, y sin modificar:

- `src/engine/**`, incluido `solver.ts`, `units.ts`, formulación, signos y resultados.
- `src/workers/**` y los protocolos de worker.
- `src/types.ts` y los contratos de selección/modelo.
- `src/store/ProjectContext.tsx`, incluido historial, undo/redo, persistencia e invalidación de análisis.
- `src/data/modelOperations.ts`, `migrate.ts`, `projectStorage.ts` y `defaultProject.ts`.
- `src/components/StructuralCanvas.tsx`, `src/components/canvasInteraction.ts` y helpers de geometría/snapping/selección.

La Fase 8 solo añade formato, buffers de formulario, jerarquía visual, helper text, estados bloqueados y accesibilidad alrededor de esos contratos.
