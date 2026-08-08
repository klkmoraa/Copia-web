# AG-014A

# Fase 1: Corrección de Presets de Materiales/Perfiles y Explicador de Casos de Carga

# Implementada

# 2026-08-05

# UX / Inspector / Cargas

# Resumen ejecutivo

Primera fase del Plan Maestro de UX de **structureCo**. Resuelve el problema de usabilidad por el cual la selección de presets de materiales y perfiles no conservaba el nombre elegido en pantalla, simplifica la categorización de elementos y añade un explicador pedagógico sobre Casos de Carga en el Inspector.

# Problema

1. **Reinicio de Valor en Selectores de Presets**:
   - En `MaterialPresetSelector.tsx` y `SectionPresetSelector.tsx`, el atributo `<select value="">` estaba hardcoded a la opción vacía (`""`).
   - Cuando el usuario seleccionaba un material (ej. *Acero A992*) o un perfil (ej. *W12x26*), las propiedades físicas ($E, A, I$) se actualizaban correctamente en el modelo, pero el menú desplegable volvía visualmente a "Elegir material estándar...", haciendo pensar al usuario que la acción no había tenido efecto.
2. **Complejidad y Falta de Claridad en Categorías**:
   - Las listas desplegables contenían cadenas de texto largas con unidades crudas que saturaban la interfaz del Inspector en pantallas estrechas.
3. **Comprensión de "Casos de Cargas"**:
   - Los usuarios principiantes e intermedios no comprendían la diferencia entre aplicar una carga en un Caso de Carga individual (*Muerta D, Viva L, Viento W*) y evaluar combinaciones estructurales. Faltaba una guía contextual en el formulario de cargas del Inspector.

# Solución propuesta

1. **Gestión de Estado en `MaterialPresetSelector.tsx` y `SectionPresetSelector.tsx`**:
   - Introducir la variable de estado local `const [selectedId, setSelectedId] = useState<string>('')`.
   - Vincular `value={selectedId}` en el elemento `<select>`. Al disparar el handler `onChange`, actualizar `setSelectedId(val)` y emitir el objeto mediante `onSelect(item)`.
   - Si las propiedades del miembro cambian manualmente fuera del preset, permitir que el usuario vea el nombre del preset activo o seleccione uno nuevo sin interferencias.

2. **Simplificación UX y Etiquetas amigables en `catalogs.ts`**:
   - Presentar etiquetas de grupo claras:
     - Materiales: **Acero Estructural**, **Concreto Armado**, **Madera**, **Aluminio**.
     - Perfiles: **Perfiles I (W, IPE, HEB)**, **Tubulares Rectangulares (HSS)**, **Tubulares Circulares (Pipe)**, **Canales (C, UPN)**, **Ángulos (L)**, **Secciones Rectangulares**.
   - Formatear los nombres de opciones de forma compacta (ej. `W12x26 · A = 49.4 cm²`).

3. **Inclusión de Explicador Contextual en `InspectorProperties.tsx`**:
   - En la sección de selección de Caso de Carga para cargas nodales y de miembro, incorporar un componente `InspectorHelper`:
     - *"💡 **¿Qué es un Caso de Carga?**: Permite agrupar las acciones por su origen (ej. Carga Muerta, Viva o Viento) para analizarlas individualmente o combinadas según normas de diseño."*

# Criterios de Aceptación

- [x] Al seleccionar un material en el Inspector, el menú desplegable retiene y muestra el nombre del material elegido.
- [x] Al seleccionar un perfil comercial, el menú desplegable retiene y muestra la designación del perfil elegido.
- [x] Las opciones del catálogo están organizadas en grupos limpios con etiquetas amigables en español e inglés via `useI18n()`.
- [x] Aparece una nota explicativa pedagógica en la selección de Casos de Carga dentro del Inspector.
- [x] `npm run verify` pasa al 100% (lint, typecheck, suite de tests de Vitest y presupuestos de bundle).

# Archivos afectados

- `src/features/inspector/MaterialPresetSelector.tsx`
- `src/features/inspector/SectionPresetSelector.tsx`
- `src/features/inspector/InspectorProperties.tsx`
- `src/features/inspector/Inspector.test.tsx`
- `src/i18n/catalogs.ts`

# Notas de implementación (2026-08-05)

Validación contra el código real antes de editar, con tres desviaciones deliberadas
respecto al texto original de la propuesta:

1. **El estado local no basta por sí solo.** `selectedId` recuerda lo que el usuario
   eligió, pero mostrarlo sin condiciones mentiría en dos escenarios reales:
   - *Otro miembro*: los selectores viven en un panel que no se remonta al cambiar de
     selección, así que el preset del miembro A seguiría visible sobre el miembro B.
     Se resuelve con `key={selectionKey}` en el llamador (`InspectorProperties.tsx`).
   - *Edición manual*: si se edita E, A o I a mano, el preset deja de describir al
     miembro. Cada selector recibe ahora los valores vigentes (`current`) y solo
     muestra el preset mientras coincidan exactamente; si no, vuelve al placeholder.

   No se derivó el preset únicamente de las propiedades porque el catálogo tiene
   materiales con E, G y densidad idénticos (A36, A992, A500 Gr. B, AISI 304): la
   deducción sería ambigua. El estado local registra la intención del usuario y el
   contraste con `current` garantiza que nunca se muestre información falsa.

2. **Las etiquetas por categoría ya existían desde AG-009.** El problema real de
   saturación no estaba en los grupos sino en los nombres de opción: el catálogo de
   `src/data` (frontera protegida, no modificable) guarda designaciones largas y en
   español, que se filtraban sin traducir a la interfaz en inglés. Se añadieron
   nombres cortos y localizados en `catalogs.ts` (`preset.material.*`,
   `preset.section.*`) que los selectores resuelven con retorno al nombre del
   catálogo si falta la clave. Las designaciones comerciales (W12x26, IPE 300, HSS…)
   son neutrales al idioma y se muestran tal cual.

3. **"Concreto armado" → "Concreto estructural".** El catálogo contiene módulos
   elásticos de concreto simple por f′c, no propiedades de secciones de concreto
   reforzado; etiquetar el grupo como "armado" sería técnicamente inexacto en una
   herramienta educativa. Igual criterio en el resto de grupos (*Acero estructural*,
   *Madera estructural*, *Aluminio estructural*).

El explicador de Casos de Carga se implementó con el `InspectorHelper` existente
(que ya aporta su propio icono), sin emoji ni marcado enriquecido, bajo el selector
de caso tanto en cargas nodales como en cargas de miembro.

Cinco pruebas nuevas en `Inspector.test.tsx` cubren: retención del preset elegido,
no arrastre entre miembros con propiedades idénticas, invalidación al editar a mano,
etiquetas compactas traducidas y presencia del explicador en ambos formularios.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

Antigravity-propuestas/aprobadas/AG-014A-presets-y-casos-de-carga.md

Instrucciones de ejecución:
1. Valida la propuesta contra el código real antes de modificar archivos.
2. ACTIVACIÓN OBLIGATORIA DE SUPERPOWERS Y PLUGINS:
   - Activa y sigue el flujo de trabajo de Superpowers (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`, `systematic-debugging`).
   - Aplica los plugins configurados (`frontend-design`, `ui-theme-designer`, `code-simplifier`, `typescript-lsp`, `security-guidance`).
3. MEJORA Y CORRECCIÓN AUTÓNOMA:
   - Si al analizar el código real detectas que alguna recomendación o enfoque de este documento es subóptimo, imperfecto o mejorable frente a la estructura real del proyecto, corrígelo y mejóralo libremente para lograr el resultado más limpio y profesional, manteniendo la intención de negocio y respetando la frontera matemática.
4. Implementa los 3 puntos principales descritos en el documento:
   - Estado local `selectedId` en `MaterialPresetSelector.tsx` y `SectionPresetSelector.tsx`.
   - Etiquetas simplificadas por categoría en `src/i18n/catalogs.ts`.
   - Guía explicativa `InspectorHelper` para Casos de Carga en `InspectorProperties.tsx`.
5. Ejecuta lint, tests y build (`npm run verify`).

Al terminar:
- resume los cambios
- lista los archivos modificados y creados
- indica las pruebas ejecutadas
- actualiza el estado de la propuesta a "Implementada" y mueve el documento a:
  Antigravity-propuestas/implementadas/AG-014A-presets-y-casos-de-carga.md
