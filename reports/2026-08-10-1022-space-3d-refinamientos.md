# Refinamientos de Space 3D: selector, escala, imports, confirmación

**Fecha:** 2026-08-10 10:22
**Agente:** Claude Code
**Rama:** main (23 commits locales, sin push)

## Qué cambió

Tres commits posteriores al último reporte (`2026-08-10-0910-space-3d-oraculos-y-mejoras.md`), sin reporte propio hasta ahora. Este los cubre.

1. **`9f583ae` — pulido del selector de objetivo y la escala.** El selector de caso/combinación agrupa ambos con `<optgroup>` en vez de una lista plana que los confundía (son conceptos de dominio distintos: un caso vale 1×, una combinación suma factores). El multiplicador manual de la deformada quedaba sin acotar — duplicar sin límite produce una deformada que ya no cabe en pantalla, reducir sin límite la vuelve invisible — así que ahora está acotado a ±64× (seis duplicaciones) y los botones se deshabilitan en el límite. El texto de la escala vigente es una región viva (`role="status" aria-live="polite"`), siguiendo el mismo patrón que ya usa `AnalysisStatus`/`ResultsPanel` en el resto del producto.

2. **`589105b` — imports de Three.js por nombre.** Intento de reducir el tamaño del bundle: se cambió `import * as THREE from 'three'` (todo el espacio de nombres) por imports nombrados de los ~24 símbolos realmente usados. **Resultado medido, no asumido:** reconstrucción completa y limpia (borrando `dist` y la caché de Vite), y el chunk `Space3DWorkspace` quedó byte a byte idéntico — 638,39 kB / gzip 161,27 kB. Rolldown ya eliminaba lo no usado del namespace import; el estilo de import no movía el tamaño final. Se conservó igual porque documenta la superficie real de Three.js que consume el visor, pero no se reporta una reducción que no ocurrió. Bajar el peso de verdad exigiría sustituir `WebGLRenderer`/helpers por geometría dibujada a mano — cambio de mayor riesgo sobre un renderer ya validado por los oráculos, fuera de alcance sin pedirlo explícitamente.

3. **`03e123f` — confirmación antes de descartar el modelo.** «Cargar ejemplo» y «Proyecto vacío» reemplazaban el modelo al instante; son recuperables con Deshacer, pero eso no es obvio para quien no lo sabe. Ahora, si el proyecto tiene contenido, cualquiera de los dos abre un diálogo (`Dialog` del sistema de diseño — foco atrapado, cierre con Escape) que nombra la acción y explica que se puede deshacer, antes de ejecutarla. Si ya está vacío, no hay nada que perder y actúa directo.

## Por qué

Continuación de la ronda de mejoras autorizada («autorizo... agregar mejoras»). Las tres candidatas se identificaron por inspección directa del código entregado en la sesión anterior, no por una auditoría nueva.

## Archivos tocados

- `src/features/space3d/Space3DWorkspace.tsx` — selector con `optgroup`, límites de escala, diálogo de confirmación, `requestReplace`/`confirmReplace`.
- `src/features/space3d/Space3DWorkspace.test.tsx` — pruebas de los tres cambios (RED→GREEN en cada uno).
- `src/space3d/view/threeViewport.ts` — imports nombrados de Three.js.
- `src/i18n/catalogs.ts` — claves ES/EN nuevas: `space3d.loadCombination`, `space3d.confirmReplace*`.

## Cómo verificar

```bash
npm.cmd run lint && npm.cmd run typecheck && npm.cmd run verify:protected && npm.cmd test && npm.cmd run build && npm.cmd run verify:perf && npm.cmd run verify:space3d
```

Resultados obtenidos:

- Suite completa: **134 archivos, 1015 aprobadas, 8 omitidas, 0 fallos**.
- `verify:protected`: 29 archivos de la frontera 2D intactos.
- Build y `verify:perf` correctos; chunk `Space3DWorkspace` sin cambio de tamaño (confirmado explícitamente arriba).
- Capacidad: 150/300 aprobada.
- Navegador real: `optgroup` "Caso de carga"/"Combinación" visibles; ocho clics en "Duplicar" dejan el botón deshabilitado con la escala en su tope; diálogo de confirmación con título correcto, "Cancelar" no toca el modelo, "Reemplazar" lo vacía y "Deshacer" lo restaura completo (4 nudos).

## Pendiente / siguiente paso

- **Pase con lector de pantalla real.** No ejecutable en este entorno: no hay NVDA/VoiceOver disponibles. Sigue como pendiente real, no se marca como hecho.
- **Frame3DD** como tercer oráculo, sólo si aparece un binario alcanzable o un toolchain de C. No bloquea nada: el gate 3D-G2 ya tiene dos oráculos independientes (OpenSees, PyNite).
- **Push.** 23 commits sólo en local. Codex no verá nada hasta que se confirme explícitamente en el chat.
