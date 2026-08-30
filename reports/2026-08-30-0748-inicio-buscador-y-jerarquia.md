# Inicio: buscador rápido, CTA primario con relleno completo y mosaico de dos columnas

**Fecha:** 2026-08-30 07:48
**Agente:** Claude Code
**Rama:** claude/home-screen-redesign-vdm5wh

## Qué cambió

Se propuso (como maqueta HTML, fuera del repo) un rediseño visual de la pantalla de
Inicio y, tras la aprobación del usuario, se incorporó al código real en tres piezas:

1. **Buscador rápido** en la cabecera del lanzador (`welcome-jump-bar`), con atajo de
   teclado (`/` fuera de un campo de texto, o `⌘K`/`Ctrl+K` en cualquier momento).
   Filtra por texto la MISMA lista de "Empezar" (nombre + descripción de cada
   destino) y, a la vez, la lista de "Recientes" del `ProjectHub` real — no es una
   vista nueva, es un recorte del mismo contenido. Con la caja vacía el
   comportamiento es idéntico al de antes. Sin coincidencias, la columna lo dice en
   vez de quedarse muda.
2. **"Nuevo proyecto" como acción primaria real**: pasa de fila con icono de acento
   a fila completa con relleno de acento (azul de sistema), ocupando el ancho total
   de la rejilla. De paso se corrigió un bug real preexistente: el icono de esa fila
   usaba el token `--sc-color-action-on-primary`, que no existe en `tokens.css` —
   la declaración de color quedaba inválida y el glifo se pintaba en gris sobre
   fondo azul, con contraste pobre. Ahora usa `--sc-color-action-foreground` (blanco),
   que sí está definido y es el que usa el resto del sistema para texto sobre
   relleno de acento.
3. **Mosaico de dos columnas** para las cuatro capacidades intermedias (Nuevo
   ejercicio, Desde plantilla, Biblioteca personal, Space 3D): mismo DOM plano de
   siempre (siguen siendo los mismos siete hijos directos de `.welcome-action-list`
   que cuenta `welcomeFlow.test.tsx`), pero agrupados visualmente por CSS Grid en
   vez de apilados en una lista larga. Las dos tarjetas de archivo (Importar /
   DXF) siguen a ancho completo. Por debajo de 460px vuelve a una columna.

No se tocaron: la filosofía de "una superficie por destino" ni el criterio de "un
solo acento en toda la pantalla" que ya documentaba `29-welcome.css` — el acento
sigue estando solo en la fila primaria, ahora más grande, no repartido en más
sitios. Tampoco se añadieron miniaturas de proyecto ni filtros "Favoritos/Aula" en
`ProjectHub`: el propio CSS de esa tabla (`CRI-112`) documenta que esa decisión ya
se tomó y se descartó a propósito por falta de dato real que mostrar; no hay
`favorite` ni miniatura en `StoredProjectRecord`, así que inventarlos habría sido
justo lo que ese comentario prohíbe.

## Por qué

El usuario pidió una propuesta de "rediseño más upgrade" de Inicio (mejoras
visuales, de opciones y de acomodo). Se presentó primero como maqueta interactiva
(Artifact HTML, con toggle claro/oscuro) para acordar dirección antes de tocar
código de producción — la pantalla ya había pasado por muchas rondas de rediseño
documentadas en `reports/`. Aprobada la maqueta ("me gusta, incorpórala"), se llevó
al código real ajustando lo que la maqueta proponía (CTA de gradiente, tarjetas de
color por dominio, miniaturas por proyecto) a las reglas ya vigentes en
`29-welcome.css` — comentarios explícitos como "decisión 2 del sistema" (un solo
acento) y "decisión 4" (sin elevación, solo tinte) — en vez de sobrescribirlas sin
mirar. Las miniaturas de proyecto se descartaron al leer `CRI-112` en
`projectHub.css`, que documenta por qué esa tabla no las lleva.

## Archivos tocados

- `src/features/welcome/WelcomeScreen.tsx` — estado y atajo de teclado del
  buscador; filtro de las siete tarjetas de "Empezar"; mensaje de "sin
  resultados"; insignia "Experimental" de Space 3D movida junto al nombre (ya no
  cabe en la columna de flecha del mosaico de dos columnas); `filter` pasado a
  `Phase2ProjectHub`.
- `src/features/welcome/Phase2ProjectHub.tsx` — reenvía `filter` a `ProjectHub`.
- `src/features/project-hub/ProjectHub.tsx` — nuevo prop opcional `filter`; recorta
  `projects` por nombre; mensaje `hub.noMatches` cuando el filtro no encuentra
  nada pero sí hay proyectos guardados.
- `src/styles/29-welcome.css` — barra de búsqueda; rejilla de dos columnas para
  `.welcome-action-list`; CTA primario con relleno completo (y el fix del token
  roto); ajuste de alto/ajuste de línea para las tarjetas emparejadas;
  colapso a una columna en ≤460px.
- `src/i18n/es/welcome.ts`, `src/i18n/en/welcome.ts` — claves nuevas:
  `welcome.searchLabel`, `welcome.searchPlaceholder`, `welcome.searchClear`,
  `welcome.searchNoMatches`.
- `src/i18n/phase2Catalogs.ts` — clave nueva `hub.noMatches` (es/en).
- `src/features/welcome/welcomeFlow.test.tsx` — pruebas del buscador (recorta,
  restaura, mensaje sin resultados, atajo `/`).
- `src/features/project-hub/ProjectHub.test.tsx` — pruebas del prop `filter`
  (recorta por nombre, mensaje sin coincidencias).

## Cómo verificar

```bash
npx vitest run src/features/welcome src/features/project-hub src/i18n src/App.test.tsx
npx tsc -b --noEmit
npx oxlint src/features/welcome src/features/project-hub src/i18n
```

Visualmente: `npm run dev`, abrir `/`, probar el buscador (escribir "plantilla"
recorta a una tarjeta; borrar la devuelve las siete), el atajo `/`, y el tema
oscuro/claro. Verificado con capturas de Playwright contra el servidor de
desarrollo local (escritorio 1280×900, móvil 390×844, claro y oscuro) — sin
regresiones visuales encontradas.

## Pendiente / siguiente paso

Nada pendiente de esta tarea. Queda abierto, si el usuario lo pide más adelante:
extender el buscador a un modo "todo en uno" que también salte a comandos del
editor (no solo Inicio), y considerar miniaturas de proyecto en `ProjectHub` el
día que exista un dato real que mostrar (por ejemplo, una miniatura persistida al
guardar, no derivada en cada render).
