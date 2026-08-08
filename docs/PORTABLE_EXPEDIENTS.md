# Expedientes PDF y paquetes structureCo

## Objetivo

structureCo genera una memoria de cálculo legible y, a la vez, conserva el
modelo y los resultados exactos para reabrirlos sin interpretar dibujos ni usar
OCR. El flujo se encuentra en **Importar archivo** y en el menú **Exportar**.

## PDF inteligente de structureCo

La parte visible contiene:

- una primera página ejecutiva con resultados gobernantes, DCL global, cargas,
  reacciones y cierre de equilibrio;
- una página visual independiente para cada diagrama global `N`, `V` y `M`;
- operaciones claras por miembro, funciones polinómicas exactas por tramo,
  unidades activas, extremos y posiciones críticas;
- una página propia de unidades, convenciones de signo, alcance del análisis y
  limitaciones declaradas, para que el documento se pueda leer sin depender de
  la aplicación;
- una secuencia resumida del procedimiento desde el modelo hasta la
  verificación;
- un anexo técnico con geometría, cargas, reacciones, desplazamientos,
  auditoría, ecuaciones completas y, cuando se solicita, matrices educativas.

Los valores numéricamente despreciables se presentan como cero en las páginas
visuales. El anexo conserva su valor técnico completo. Desactivar la traza
educativa omite las matrices, pero mantiene las cinco páginas visuales y el
payload reimportable.

El PDF incorpora `structureco-payload.json` como attachment. Ese payload incluye
el `ProjectModel`, el `AnalysisResult`, procedencia, versión y checksum SHA-256.
Al importarlo se verifica la integridad antes de restaurar el proyecto.

## Paquete `.structureco`

Es un ZIP con extensión propia:

```text
manifest.json
portable/payload.json
project.json
analysis/result.json
report/calculation-report.pdf
```

El manifest apunta a cada archivo y repite el checksum del payload. El lector
rechaza paquetes incompletos o cuyos archivos separados no coinciden con el
snapshot firmado.

## PDF externo o escaneado

Un PDF ajeno no se convierte silenciosamente en un modelo. El importador extrae
texto y metadatos, lo clasifica como digital o escaneado y presenta advertencias.
Geometría, cargas y resultados quedan bloqueados hasta una futura etapa de OCR y
confirmación humana. Esto evita inventar DCL o esfuerzos a partir de una imagen.

## Límites y seguridad

- PDF: máximo 25 MB y 120 páginas desde el centro de importación; hasta 24
  adjuntos examinados, 20 MB cada uno.
- `.structureco`: máximo 40 MB; hasta 32 entradas por paquete, 64 MB
  descomprimidos por entrada, 128 MB descomprimidos en total, relación de
  compresión máxima 120:1 (protección contra zip bombs). JSON plano: 20 MB.
  Toda ruta interna se valida contra `../`, rutas absolutas y profundidad
  excesiva antes de leerse. Ver `src/utils/fileGuards.ts` y
  `src/utils/portableSecurity.test.ts`.
- El tamaño se comprueba antes de leer el archivo completo (`Blob.slice` sobre
  la firma), no después.
- Una inspección de archivo pesada puede cancelarse desde el centro de
  importación; el resultado de una inspección abandonada nunca sobrescribe el
  de una selección posterior.
- Se usa el build `legacy` de PDF.js para compatibilidad amplia con Safari.
- Los binarios PDF no se guardan en `localStorage`; solo se procesan en memoria.
- En iOS se intenta la hoja nativa de compartir y se mantiene descarga como
  alternativa.
- Importar un expediente completo entra en el historial y puede deshacerse.

## Verificación

```bash
npm run verify
npm run qa
npm run qa:webkit
```

La suite WebKit recorre importación JSON y reconocimiento de PDF nativo en
perfiles iPhone 13 e iPad Pro 11, comprobando viewport, targets táctiles y
errores de consola. La validación final en Safari real debe repetirse desde el
enlace público en el dispositivo del usuario.
