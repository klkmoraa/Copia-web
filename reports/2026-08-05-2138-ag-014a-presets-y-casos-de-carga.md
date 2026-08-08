# AG-014A · Presets que conservan lo elegido y explicador de Casos de Carga

**Fecha:** 2026-08-05 21:38
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Los selectores de material y perfil del Inspector ya no se reinician al placeholder
después de aplicar un preset: ahora muestran lo que el usuario eligió. Las opciones
pasaron a nombres cortos y traducidos (el catálogo de `src/data` guarda designaciones
largas en español que se filtraban sin traducir a la interfaz en inglés), y los grupos
se renombraron a *Acero / Concreto / Madera / Aluminio estructural*. Se añadió un
`InspectorHelper` bajo el selector de Caso de Carga, en cargas nodales y de miembro,
explicando para qué sirve agrupar acciones por origen.

## Por qué

Implementación de la propuesta aprobada `AG-014A` (Fase 1 del Plan Maestro de UX).
El `value=""` hardcodeado hacía creer al usuario que la selección no había tenido
efecto, aunque E/A/I sí se actualizaban en el modelo.

Tres desviaciones deliberadas respecto al texto de la propuesta, documentadas en el
propio documento:

1. **El estado local `selectedId` no basta.** Sin más condiciones mentiría al cambiar
   de miembro (el panel no se remonta) y al editar E/A/I a mano. Se añadió
   `key={selectionKey}` en el llamador y una comparación contra los valores vigentes
   del miembro (`current`): el preset solo se muestra mientras describa realmente al
   miembro. No se dedujo el preset solo de las propiedades porque cuatro aceros del
   catálogo comparten E, G y densidad idénticos — la deducción sería ambigua.
2. **Los grupos por categoría ya existían desde AG-009.** El problema real de
   saturación estaba en los nombres de opción, no en los grupos; ahí se concentró el
   trabajo de simplificación y traducción.
3. **"Concreto armado" → "Concreto estructural".** El catálogo tiene módulos elásticos
   de concreto simple por f′c, no propiedades de secciones reforzadas.

La frontera matemática protegida no se tocó: los nombres cortos viven en `catalogs.ts`
con retorno al nombre del catálogo si falta la clave.

## Archivos tocados

- `src/features/inspector/MaterialPresetSelector.tsx` — estado local `selectedId`, prop
  `current` para invalidar el preset cuando el miembro deja de coincidir, mapa de
  etiquetas cortas traducidas.
- `src/features/inspector/SectionPresetSelector.tsx` — mismo patrón; etiquetas
  traducidas solo para las secciones genéricas (las designaciones comerciales son
  neutrales al idioma).
- `src/features/inspector/InspectorProperties.tsx` — `key={selectionKey}` y prop
  `current` en ambos selectores; `InspectorHelper` de caso de carga en los formularios
  de carga nodal y de miembro.
- `src/i18n/catalogs.ts` — 16 claves `preset.material.*` / `preset.section.*` en ES y
  EN, `inspector.loadCaseHelp`, y grupos de material renombrados.
- `src/features/inspector/Inspector.test.tsx` — 5 pruebas nuevas (retención del preset,
  no arrastre entre miembros con propiedades idénticas, invalidación al editar a mano,
  etiquetas compactas traducidas, explicador presente en ambos formularios).
- `Antigravity-propuestas/implementadas/AG-014A-presets-y-casos-de-carga.md` — movida
  desde `aprobadas/`, estado **Implementada**, criterios marcados y notas de
  implementación.
- `Antigravity-propuestas/backlog.md`, `Antigravity-propuestas/roadmap.md` — AG-014A
  marcada como Implementada. **Nota:** estos dos archivos ya traían cambios previos sin
  commitear de la sesión anterior (alta de las filas AG-014A–D y reordenamiento del
  roadmap); quedan incluidos en este commit.

## Cómo verificar

```bash
npm run verify
```

Resultado obtenido: oxlint limpio · frontera protegida intacta (29 archivos) ·
675 pruebas en 90 archivos · build ok · presupuesto 635 640 B / 171 178 gzip
(techo 648 000 / 174 000).

Verificación manual en el navegador (`npm run dev`, ejemplo *Pórtico de ejemplo*):
seleccionar una barra, elegir *Acero ASTM A992 (Gr. 50)* y *W12x26* — ambos quedan
visibles en su desplegable; seleccionar una carga puntual — aparece el explicador
"¿Qué es un caso de carga?". Sin errores en consola.

## Pendiente / siguiente paso

Nada pendiente en AG-014A. Sigue AG-014B (Sustitución numérica con datos reales en
Modo Aula), que depende de esta fase.

Durante la primera corrida de `npm run verify` fallaron por timeout de 5 s tres
pruebas ajenas a este cambio (`src/App.test.tsx` ×2, `ComponentLab.topbar.test.tsx`).
Se comprobó que son flakes por contención de recursos, no una regresión: pasan
aisladas, la corrida completa con los cambios aplicados quedó en 675/675, y la
corrida de baseline sin los cambios también pasó. Si reaparecen con frecuencia, vale
la pena subir el `testTimeout` de esos archivos.
