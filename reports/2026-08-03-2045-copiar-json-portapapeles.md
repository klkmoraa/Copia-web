# Copiar proyecto como JSON al portapapeles

**Fecha:** 2026-08-03 20:45
**Agente:** Claude Code
**Rama:** main

## Qué cambió

Se agregó un botón "Copiar datos" al menú de exportación (escritorio y
móvil) de `TopBar.tsx` que copia el JSON normalizado del proyecto
(`normalizeProject(project)`, la misma función que ya usa
`exportProjectJson`) directo al portapapeles vía `navigator.clipboard.writeText`,
con fallback automático a la descarga de archivo existente
(`exportProjectJson`) si el portapapeles no está disponible (contexto no
seguro, API ausente, o si `writeText` falla). Es una funcionalidad nueva que
existe en `remix-structureco` pero **no estaba documentada en ninguna de las
12 carpetas de `google-ai-diffs/`** — la encontró el segundo análisis
(comparación de código completo) de esta sesión.

Como el sistema de toasts de Remix (carpeta `004-toast-notification`) todavía
no se portó — depende de una decisión pendiente sobre la librería `motion`,
que el usuario no ha aprobado — no se copió ese mecanismo. En su lugar, el
propio botón del menú cambia de ícono/texto brevemente (a "¡Copiado!" o, en el
caso de respaldo, "Portapapeles no disponible: se descargó el archivo"; el
menú se queda abierto ~1.8 s para que sea visible) usando estado local de
React, sin componentes ni dependencias nuevas.

Se corrigió además un defecto de copywriting que sí tenía el código fuente en
Remix: ahí, tanto el caso de éxito (copia real) como el caso de respaldo
(descarga de archivo, que **no** copia nada) mostraban el mismo mensaje de
"copia exitosa". Aquí cada resultado tiene su propio texto.

## Por qué

Séptima propuesta aprobada del backlog. Utilidad genuina (pegar el proyecto
completo en un chat, issue o LLM sin descargar un archivo) y de bajo riesgo:
solo toca la capa de presentación de `TopBar.tsx`, reutiliza
`normalizeProject`/`exportProjectJson` ya existentes y probados, no depende
de librerías nuevas ni de la decisión de `motion` pendiente.

## Archivos tocados

- `src/features/topbar/TopBar.tsx` — `handleCopyJson`, estado
  `jsonCopyState`, botón "Copiar datos" en el menú de exportación de
  escritorio y en el menú móvil.
- `src/i18n/catalogs.ts` — claves nuevas `export.copyData`,
  `export.copySuccessful`, `export.copyFallbackDownloaded` en español e
  inglés.
- `src/features/topbar/TopBar.test.tsx` — 2 pruebas nuevas: copia exitosa al
  portapapeles (verifica que el payload es JSON válido) y fallback a
  descarga cuando el portapapeles no está disponible.

## Cómo verificar

```bash
npx vitest run src/features/topbar src/i18n
npm run lint
npm run typecheck
node scripts/check-protected-baseline.mjs   # 26 archivos intactos
npm test        # 87 archivos / 633 pruebas en verde (+2 nuevas)
```

No se pudo completar verificación visual en navegador en esta sesión (mismo
bloqueo de permisos del panel de vista previa que en los cambios anteriores).
Se recomienda, en `npm run dev`, abrir el menú de exportación, hacer clic en
"Copiar datos" y pegar en un editor de texto para confirmar el JSON
resultante.

## Pendiente / siguiente paso

El sistema de toasts real (que reemplazaría este feedback en el propio botón
por una notificación flotante no intrusiva) sigue pendiente de la decisión
sobre la librería `motion` — propuesta 8 del backlog, todavía sin resolver.
Sin push (instrucción explícita del usuario: trabajo solo local, sin GitHub).
