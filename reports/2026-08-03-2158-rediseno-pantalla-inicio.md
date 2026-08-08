# Rediseño de la pantalla de inicio (WelcomeScreen)

**Fecha:** 2026-08-03 21:58
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se reimplementó por completo `WelcomeScreen.tsx` portando (con varios
apartamientos deliberados, ver abajo) la idea de
`remix-structureco/google-ai-diffs/003-home-redesign`:

- **Hero**: pastilla de identidad, título/subtítulo existentes, fila de 3
  "highlights" verificables, y un lanzador de 3 tarjetas grandes (Lienzo
  libre / Modo Aula / Continuar proyecto — esta última con conteo de
  nudos/barras del proyecto actual) en vez de los 3 botones apilados
  anteriores.
- **Vitrina de plantillas**: grid filtrable (Todos/Académicos/Modelos) que
  muestra los **6** proyectos de ejemplo (antes solo 3, curados a mano),
  cada uno con una insignia de categoría y su propio ícono, más una tarjeta
  de importación rediseñada.
- **Flujo de trabajo**: banner inferior con los mismos 3 pasos de siempre
  (Modela/Carga/Analiza), con nueva presentación visual.
- Animaciones de entrada (`motion`, fundido+desplazamiento) en las
  secciones y micro-interacciones `whileHover`/`whileTap` en las tarjetas,
  todas con una variante reducida cuando `useReducedMotion()` lo indica
  (Remix no manejaba este caso en absoluto para esta pantalla).

## Por qué me aparté del código/contenido de Remix

El usuario pidió expresamente que el resultado fuera fiel a Remix pero
verificado y sin errores. Encontré varios problemas reales en el diff de
origen que no se debían portar tal cual:

1. **Reclamo falso de norma técnica**: Remix mostraba como "highlight" fijo
   "Norma NTC CDMX 2023" — pero el motor de structureCo no implementa
   verificación contra ningún código de diseño; ese texto viene de que uno
   de los ejemplos internos tiene una *combinación de carga* nombrada así,
   no de una capacidad real del producto. Se reemplazó por dos highlights
   verificables en la documentación existente
   (`docs/MATHEMATICAL_SPEC.md`, `docs/FTOOL_COMPARISON_MATRIX.md`,
   `docs/VERIFICACION_HIBBELER_*.md`): "Método de rigidez directa" y
   "Verificado contra FTool y Hibbeler".
2. **Formatos de importación inexistentes**: Remix anunciaba
   "Formatos aceptados: JSON de proyecto, .FTL / .POS (FTool) o Expedientes
   PDF" en la tarjeta de importación — `PortableImportCenter` no acepta
   archivos FTool (esos solo se usan como fixtures internas de verificación
   del motor, no como una vía de importación de usuario). Se reutilizó la
   descripción ya existente y correcta (`welcome.importDescription`: "Revisa
   JSON, PDF o expedientes .structureco").
3. **Versión codificada a mano**: la insignia de versión decía `v0.8.2`
   como literal fijo — exactamente el tipo de error que el propio
   `CHANGELOG` de 0.8.1 documenta haber corregido en el PDF ("la versión de
   la aplicación ya no queda fija en un literal desactualizado"). Se usa
   `APP_VERSION` (de `appVersion.ts`, inyectado desde `package.json` en
   build) en su lugar.
4. **Categorización de ejemplos con `.includes(nombre)`**: el original
   detectaba la categoría de cada plantilla con comparaciones de substring
   sobre el nombre (`name.includes('Hibbeler')`, `name.includes('Armadura')`
   sin distinguir mayúsculas de forma consistente). Además, `src/data/**`
   es parte de la frontera matemática protegida — no podía agregarle un
   campo `category` explícito aunque quisiera. Se implementó en su lugar un
   diccionario explícito por nombre exacto (`EXAMPLE_META`), dentro de
   `features/welcome/` (no toca `src/data/`), siguiendo el mismo patrón que
   ya usa `examplePresentation.ts` para localizar estos mismos 6 nombres.
5. **Cadenas fijas en español**: el texto de la pastilla de identidad, los
   3 highlights, las descripciones de las tarjetas de lanzamiento, la
   descripción del showcase, las etiquetas de los filtros y "Cargar modelo"
   estaban en español codificado en el JSX. Se agregaron ~18 claves nuevas
   de i18n (es/en) — Structure mantiene inglés completo, a diferencia de
   Remix.
6. **Reduced motion**: se agregó manejo explícito (`useReducedMotion()`)
   para las animaciones de entrada de sección y los `whileHover`/`whileTap`
   de las tarjetas, ausente en el original.

## Limpieza de CSS

`remix-structureco/styles.css` conservaba **todo** el CSS del diseño
anterior sin usar (clases `.welcome-option`, `.welcome-primary-button`,
`.welcome-secondary-button`, `.welcome-example-rail`, `.welcome-example-card`,
`.welcome-options*`, `.welcome-steps*`, `.welcome-primary-actions`) mezclado
con las reglas nuevas — el mismo patrón de "animación/CSS huérfano" que ya
había corregido dos veces antes en esta sesión (menú P-Delta, popover). Al
portar este cambio a Structure, además de agregar las reglas nuevas, se
**eliminaron** todas las reglas obsoletas ligadas a elementos que ya no
existen, en ~8 puntos distintos del archivo (transiciones globales,
overrides de tema, los tres breakpoints móviles que las mencionaban, el
feedback de pulsación, y las animaciones de montaje `sc-fade-up`/
`native-surface-in`, que además estaban duplicadas sobre los mismos
elementos — otra causa de doble animación como la que ya había corregido en
`.popover`).

También se corrigió sobre la marcha un uso de token primitivo
(`var(--sc-black)`) que `tokens.test.ts` prohíbe consumir directamente desde
CSS de componente — se reemplazó por `rgba(0,0,0,.15)`/`rgba(0,0,0,.12)`
literales para las sombras de hover.

## Costo medido: bundle

El chunk principal (`index-*.js`, donde vive `WelcomeScreen` sin lazy-load)
pasó de **218.47 kB (gzip 69.38 kB)** a **350.79 kB (gzip 111.33 kB)** — el
mismo costo de `motion` ya medido en el commit de toasts, ahora también
pagado en el punto de entrada porque la pantalla de inicio lo usa
directamente.

## Archivos tocados

- `src/features/welcome/WelcomeScreen.tsx` — reescrito completo.
- `src/styles.css` — bloque `.welcome-*` reescrito (nuevas reglas +
  limpieza de ~8 ubicaciones obsoletas), fix de token primitivo.
- `src/i18n/catalogs.ts` — 18 claves nuevas `welcome.*` en español e inglés.
- `src/App.test.tsx` — selector `.welcome-example-card` → `.welcome-template-card`
  (el comportamiento verificado por esa prueba —que el texto en español
  crudo no se filtre cuando el idioma es inglés— no cambió, solo el nombre
  de la clase).

## Cómo verificar

```bash
npx vitest run src/App.test.tsx src/i18n src/design-system/tokens.test.ts
npm run lint
npm run typecheck
node scripts/check-protected-baseline.mjs   # 26 archivos intactos, src/data/** sin tocar
npm test        # 88 archivos / 636 pruebas en verde, sin cambios de cantidad
npm run build
```

**No se pudo completar verificación visual en navegador en esta sesión**
(mismo bloqueo de permisos del panel de vista previa que en todos los
cambios visuales anteriores). Dado que este es el cambio más grande de la
sesión, es el que más se beneficia de una revisión manual antes de darlo
por cerrado: abrir `npm run dev`, comprobar en Light/Dark, desktop/tablet/
móvil, con `prefers-reduced-motion` activado y desactivado, que las 6
plantillas se ven con su insignia correcta, que los filtros funcionan, y
que el conteo de nudos/barras de "Continuar proyecto" es correcto.

## Pendiente / siguiente paso

Backlog original de `google-ai-diffs/` completo salvo:
- **002** (fix de pantalla blanca): aplazado a pedido del usuario.
- **005** (colores de carga): saltado a pedido del usuario.

Sin push (instrucción explícita del usuario: trabajo solo local, sin
GitHub).
