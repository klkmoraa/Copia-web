# Baseline - Fase 3, Slice 3.0

Fecha: 2026-07-17  
Aplicación: structureCo 0.7.0  
Rama: `phase/3-canvas-tools`  
HEAD de entrada: `38d714e0473938c737e6841dbfcc796e9917e9ca`.

## Declaración de ejecución

Inspeccioné el repositorio y no tengo dudas bloqueantes. Procederé con estos supuestos:

1. El estado de capas será exclusivamente de sesión y de presentación; no se agregará a `ProjectModel` ni se persistirá.
2. Se aplicarán los breakpoints del PDF rector: rail expandido desde 1440 px, rail compacto entre 1024 y 1439 px y dock desde 1023 px hacia abajo.
3. Eliminar seguirá siendo contextual y conservará `Delete`/`Backspace`, undo y la semántica actual.
4. No se añadirá ningún shortcut ni dependencia.
5. Stylus se verificará mediante eventos Pointer emulados; no hay hardware físico disponible.
6. Las diez referencias conceptuales aprobadas del PDF rector sustituyen la necesidad de generar conceptos visuales nuevos.

## Comandos de entrada

| Comando | Resultado |
| --- | --- |
| `npm.cmd run verify` | **PASS** - lint, 41 archivos de prueba, 233 pruebas y build. |
| `npm.cmd run qa:phase2` | **PASS** - 117 checks, 14 filas, 0 fallos, consola y page errors vacíos. |
| `npm.cmd run qa` | **PASS** - recorrido Chromium heredado completo, consola y page errors vacíos. |
| `npm.cmd run qa:webkit` | **PASS** - iPhone 13 e iPad Pro 11. |

Los dos artefactos de Fase 2 regenerados por QA se restauraron byte a byte a `HEAD`; no forman parte del cambio de Fase 3.

## Trazabilidad Git

El PDF rector esperaba el baseline `82830e9f7dbaabcd1629a224db229712b9dee345`. El HEAD real era `38d714e0473938c737e6841dbfcc796e9917e9ca`. La diferencia se limita a documentación de entrega de Fase 2:

- `docs/ux-redesign/CHANGELOG_UX.md`
- `docs/ux-redesign/PHASE_2_DELIVERY.md`
- `docs/ux-redesign/PHASE_STATUS.md`

No existe diferencia de código productivo entre ambos puntos. La ejecución parte del HEAD real para conservar la entrega anterior.

## Frontera protegida

Se registró el inventario inicial de rutas protegidas con SHA-256 global `78e02e099cf152f2205928bf6e732fdfb10c17d885c61b5c0deb64d478cbdafa`.

Quedan fuera de alcance:

- `src/engine/**`
- `src/workers/**`
- `src/data/**`
- `src/utils/portable*`, importación, exportación y contratos portables
- `src/types.ts`
- solver, formulación, signos, unidades, precisión, schema, migraciones, fixtures y persistencia
- rediseño interno de Inspector, ResultsPanel, Aula, WelcomeScreen o TopBar

## Evidencia visual before

Flujo: Pórtico de ejemplo -> estado listo o Analizar -> Momento -> selección de M2 -> tema/viewport. La sesión del navegador mantuvo el mismo modelo, análisis y selección mientras cambiaba la composición.

| Viewport CSS | Estado cubierto | Observación de entrada |
| --- | --- | --- |
| 1536x960 | Light, Completo, listo | Rail expandido plano y canvas con chrome disperso. |
| 1440x900 | Light, listo y analizado con M2 | Rail expandido; selección usa verde de producto. |
| 1366x768 | Light, analizado | Rail compacto; alta densidad vertical. |
| 1280x800 | Light, analizado | Rail compacto; grupos sólo insinuados por separadores. |
| 1194x834 | Light, listo | Rail compacto; canvas útil. |
| 1024x768 | Light listo y Dark analizado | Borde exacto previo al dock. |
| 834x1194 | Light, listo | Dock inferior; controles de cámara y status compiten por esquinas. |
| 430x932 | Light, listo | Dock inferior de seis destinos. |
| 390x844 | Light listo y Dark analizado | Canvas estrecho, chrome superpuesto y labels sin decluttering. |

El viewport se aplicó a tamaño CSS exacto con la capacidad de viewport del navegador. El servicio de captura normaliza el raster de viewports anchos a un máximo de 960 px y puede recortar el alto visible del contenedor; por eso el manifiesto conserva por separado el viewport objetivo y el tamaño del PNG. La inspección de geometría se hizo sobre el viewport CSS nativo, no sobre la miniatura exportada.

Evidencia: [`../evidence/phase-03/before/README.md`](../evidence/phase-03/before/README.md).

## Resultado de entrada

- Funcionalidad, motor y compatibilidad: estables.
- Cero overflow horizontal de página en los nueve viewports.
- Problemas visuales a resolver: herramientas sin jerarquía de intención, chrome sin zonas seguras, capas mezcladas con settings persistentes, labels sin prioridad/LOD/colisión y selección dependiente del verde.
- Ningún archivo bajo `src/` fue editado en el Slice 3.0.

