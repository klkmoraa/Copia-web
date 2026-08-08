# Contribuir a structureCo

structureCo separa deliberadamente la interfaz del dominio estructural. Antes de
proponer un cambio, identifica si pertenece a presentación/UX o si modifica el
modelo físico.

## Preparación

```bash
npm ci
npm run verify
```

Usa una rama corta y enfocada. No incluyas `dist/`, `.netlify/`, credenciales,
archivos `.env` ni salidas temporales.

## Frontera matemática protegida

Los cambios visuales no deben modificar:

- `src/engine/**`, `src/workers/**` ni `src/data/**`;
- `src/store/ProjectContext.tsx` ni `src/types.ts`;
- solver, unidades internas, signos, geometría, topología, defaults físicos,
  schema, persistencia, migraciones o handlers matemáticos.

No redondees destructivamente valores almacenados, no conviertas campos vacíos
en cero y no dupliques validaciones de dominio. Para edición numérica conserva
las capas separadas de valor almacenado, valor presentado y borrador.

## Interfaz y accesibilidad

- Reutiliza los tokens de `src/design-system/tokens.css` y los componentes
  documentados en `docs/ux-redesign/COMPONENTS.md`.
- Para animar, lee primero `docs/design-system/MOTION.md`: CSS es el
  predeterminado, y la librería (`m.*`, nunca `motion.*`) se reserva para
  salidas y reflow de listas.
- Mantén el canvas como documento principal y la complejidad progresiva.
- Verifica Light/Dark, español/inglés, desktop/tablet/móvil, teclado, touch,
  foco visible, focus trap, Escape, retorno de foco y `prefers-reduced-motion`.
- Conserva IDs, handlers, shortcuts, undo/redo y contratos funcionales.

## Verificación

El gate mínimo para cualquier cambio es:

```bash
npm run verify
```

Incluye `verify:perf`, que **falla** si la carga inicial supera su techo
declarado. Si lo rompes, mira qué archivos aparecen como `inicial` en
`node scripts/measure-performance.mjs`: casi siempre es una dependencia que
entró al chunk de entrada por un import ansioso.

Los cambios de interfaz deben añadir el recorrido pertinente:

```bash
npm run qa
npm run qa:webkit
npm run qa:phase11
npm run qa:phase12
npm run qa:phase13
npm run qa:phase14
```

No afirmes que una regresión está cerrada sin ejecutar el comando que la prueba.
Si un gate regenera evidencia histórica de otra fase, restaura esa evidencia y
conserva únicamente los artefactos del cambio actual.

## Documentación y commits

Actualiza release notes, limitaciones o inventarios cuando cambie la experiencia
visible. Los commits deben ser reversibles, con un alcance técnico claro y sin
mezclar limpieza ajena al objetivo.
