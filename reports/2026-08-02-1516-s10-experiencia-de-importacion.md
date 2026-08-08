# S10 — Experiencia de importación

- **Agente:** Claude Code (agente principal)
- **Modelo:** Sonnet 5 (`claude-sonnet-5`)
- **Fecha:** 2 de agosto de 2026
- **Estado de GitHub:** NO UTILIZADO

## Objetivo

Auditar `ImportCenterDialog.tsx` contra §19 («Permite cancelar operaciones pesadas», «Una
inspección anterior no debe reemplazar el resultado de una selección más reciente») y corregir
lo que falte.

## Hallazgos

### 1. No existía forma de cancelar una inspección pesada (crítico, viola §19 literal)

El botón de retroceso/cancelar del pie del diálogo estaba incondicionalmente deshabilitado
mientras `stage === 'inspect'`:

```tsx
disabled={stage === 'inspect'}
```

S09 fijó presupuestos de hasta 25 MB para PDF y 40 MB para `.structureco`, con hasta 120
páginas inspeccionadas. Un archivo cercano a esos límites tarda un tiempo perceptible en
`inspectPdf`/`readPortableBundle`. Durante ese tiempo, el usuario **no tenía ninguna acción
disponible**: ni cancelar, ni volver, ni cerrar por esa vía. Es exactamente el escenario que
§19 nombra explícitamente y que no estaba implementado.

### 2. Texto de carga incorrecto durante el paso de confirmación (real, verificable)

La cabecera de carga elegía su copia así:

```tsx
{outcome ? t('importCenter.loadingResult') : t('importCenter.loadingInspect')}
```

`outcome` sólo se asigna **al final** de `runImport`, justo antes de pasar a `stage: 'result'`.
Mientras `runImport` está en vuelo (`stage === 'inspect'` de nuevo, reutilizado para el commit),
`outcome` es siempre `null` en ese momento — así que la rama `loadingResult`
(«Preparando el resultado…») era **código muerto, inalcanzable**. El usuario que pulsaba
«Importar ahora» veía «Inspeccionando el archivo…», un mensaje que no describe lo que está
pasando.

## Decisión

- Se introduce `busyPhase: 'inspecting' | 'importing' | null`, que sí distingue las dos esperas
  que comparten `stage === 'inspect'`. `outcome` no podía cumplir ese papel: solo se conoce
  después de que la espera terminó.
- El botón del pie se habilita durante `busyPhase === 'inspecting'` y actúa como «Cancelar»:
  abandona la inspección y vuelve a la selección de archivo. **Permanece deshabilitado durante
  `busyPhase === 'importing'`**, a propósito: abandonar a mitad de un commit podría dejar el
  proyecto parcialmente reemplazado, así que esa fase no es cancelable.
- Se añade `inspectionRequestRef`, un contador que se incrementa en cada nueva inspección y en
  cada cancelación. El resultado de una promesa sólo se aplica si su número de solicitud sigue
  siendo el vigente. Esto implementa literalmente la frase «una inspección anterior no debe
  reemplazar el resultado de una selección más reciente» — aunque el flujo visible ya lo impide
  estructuralmente hoy (la zona de arrastre se desmonta durante `'inspect'`), es la protección
  correcta si esa restricción de UI cambia en el futuro.
- Nueva clave de catálogo `importCenter.loadingImportingBody`, en los dos idiomas, que además
  informa al usuario de que ese paso ya no se puede cancelar.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/features/import-export/ImportCenterDialog.tsx` | `busyPhase`, `inspectionRequestRef`, `cancelInspection`; botón y copia de carga corregidos |
| `src/features/import-export/ImportCenterDialog.test.tsx` | +2 pruebas |
| `src/i18n/catalogs.ts` | 1 clave nueva × 2 idiomas |

## Archivos protegidos comprobados

`node scripts/check-protected-baseline.mjs` → «Frontera protegida intacta: 22 archivos verificados.»

## Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `npx oxlint` | limpio |
| `npm run typecheck` | limpio |
| `npx vitest run` | **78 archivos, 530 pruebas, todas en verde** (64,8 s) |
| `npm run build` | correcto |

Delta: 528 → 530 pruebas (**+2**).

### Las dos pruebas nuevas

1. **«lets the user cancel a slow inspection…»**: usa una promesa controlada manualmente para
   simular una inspección lenta, confirma que el botón «Cancelar» está habilitado y funciona,
   y **confirma que el resultado abandonado no reaparece** cuando la promesa se resuelve más
   tarde — la prueba directa de la guarda `inspectionRequestRef`.
2. **«shows distinct copy for inspecting vs. committing…»**: confirma que «Preparando el
   resultado…» ahora es alcanzable, y que el botón de retroceso está deshabilitado durante el
   commit.

## Evidencia funcional

Verificado en la aplicación real (`http://localhost:5173`): el diálogo de importación abre
desde el menú de proyecto, muestra «Cancelar» en la etapa de selección, procesa un JSON válido
y llega correctamente a «Contenido encontrado» con «Atrás» en el pie. El flujo feliz no sufrió
regresión.

La parte dependiente del tiempo (mostrar «Cancelar» específicamente durante `busyPhase ===
'inspecting'` con una inspección deliberadamente lenta) se verificó con las dos pruebas
unitarias arriba, que controlan la resolución de la promesa de forma determinista — el método
correcto para esta clase de comportamiento, más fiable que intentar retrasar una inspección
real en el navegador.

## Riesgos

- Ninguno nuevo. El cambio es aditivo: la ruta feliz (archivo pequeño, inspección casi
  instantánea) no cambia de comportamiento observable, sólo gana una ventana de cancelación
  que antes no existía.

## Limitaciones

- La cancelación es «blanda»: abandona la espera de la UI, pero no aborta el trabajo interno
  de `pdf.js`/`fflate` en curso (no existe `AbortSignal` en `pdfImport.ts`/`portableBundle.ts`,
  y añadirlo sería un cambio más profundo en esos módulos). El usuario recupera el control
  inmediatamente; el trabajo en curso simplemente ve su resultado descartado al llegar.
- Sin capturas de pantalla: el panel del navegador no compone frames en esta sesión.

## Siguiente paso

S17 — Accesibilidad y responsive.

## Commit local

`fix(import): let the user cancel a slow inspection and fix the commit-phase loading copy`
