# AG-009

# Sistema de Presets de Materiales y Perfiles Estructurales Estándar (AISC / Eurocódigo)

# Implementada

# 2026-08-05

# Producto / Feature

# Resumen ejecutivo

Propone agregar una biblioteca de presets de materiales estándar (Acero A36, Acero A992, Concreto f'c 210/280 kg/cm², Madera) y secciones comerciales predefinidas (Perfiles IPE, HEB, W AISC, Tubulares HSS) en el Inspector del Modo Completo. Esto evitará que el usuario tenga que ingresar manualmente valores de $E, A, I, G$ en metros y pascales.

# Problema

En el modo Completo actual, el usuario debe ingresar manualmente las propiedades mecánicas ($E$ en $\text{kN/m}^2$, $A$ en $\text{m}^2$, $I$ en $\text{m}^4$). Esto es propenso a errores humanos de conversión de unidades.

# Evidencia

- `src/features/inspector/InspectorProperties.tsx`: Inputs numéricos directos de $E, A, I$ (líneas 1-300).

# Objetivo

1. Crear `src/data/standardMaterials.ts` y `src/data/standardSections.ts` con catálogos parametrizados.
2. Permitir seleccionar presets desde un selector emergente en el Inspector actualizando automáticamente los valores internos $E, A, I, G$.

# Beneficio esperado

- **Usuarios**: Selección rápida de perfiles comerciales (W12x26, IPE 300, HSS) sin calcular momentos de inercia o módulos de elasticidad a mano.

# Solución propuesta

1. **Catálogo Parametrizado**:
   - `standardMaterials.ts`: Acero Structural A36, A992, Concreto 210/280 kg/cm², Madera de pino/roble.
   - `standardSections.ts`: Perfiles I (W AISC, IPE, HEB), Tubulares HSS (rectangulares y circulares), Canales U, Perfiles L.
2. **Componentes de UI en Inspector**:
   - `MaterialPresetSelector.tsx` y `SectionPresetSelector.tsx` integrados dentro de `InspectorProperties.tsx`.
3. **Mantenimiento de Valores Personalizados**:
   - Permitir editar libremente $E, A, I$ si el usuario no desea usar un preset predefinido.

# Complejidad

**Baja**.

# Prioridad

**Alta** (para utilidad profesional).

# Archivos y módulos probablemente afectados

- `src/data/standardMaterials.ts` (Nuevo)
- `src/data/standardSections.ts` (Nuevo)
- `src/features/inspector/InspectorProperties.tsx`

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

Antigravity-propuestas/aprobadas/AG-009-presets-perfiles-y-materiales-aisc.md

Instrucciones de ejecución:
1. Valida la propuesta contra el código real antes de modificar archivos.
2. Implementa los catálogos de materiales (`standardMaterials.ts`) y secciones comerciales (`standardSections.ts`) e intégralos en `src/features/inspector/InspectorProperties.tsx` mediante selectores de presets.
3. CRITERIO DE MEJORA AUTÓNOMA:
   - Si al analizar el código real o durante la implementación detectas una oportunidad de mejora directa que enriquezca la solución sin alterar la lógica de negocio ni romper la frontera matemática, agrégala.
   - Si la solución de la propuesta ya es óptima y suficiente, implementa estrictamente lo necesario sin añadir complejidad innecesaria.
4. Conserva los comportamientos y restricciones indicados en el documento.
5. Ejecuta lint, tests y build (`npm run verify`).

Al terminar:
- resume los cambios
- lista los archivos modificados y creados
- indica las pruebas ejecutadas
- actualiza el estado de la propuesta a Implementada
- mueve el documento a `Antigravity-propuestas/implementadas/AG-009-presets-perfiles-y-materiales-aisc.md`
