# Inicio: vuelta a una columna, color por dominio y profundidad real

**Fecha:** 2026-08-30 08:00
**Agente:** Claude Code
**Rama:** claude/home-screen-redesign-vdm5wh

## Qué cambió

Segunda pasada sobre el rediseño de Inicio del commit anterior, después de que el
usuario lo viera y dijera que había quedado "muy feo" y me diera libertad total
para mejorarlo. Cambios, todos en `src/styles/29-welcome.css`:

1. **Se deshizo el mosaico de dos columnas.** Apretaba título y descripción a la
   mitad del ancho y la frase se cortaba a media palabra ("edítalo…", "s…" en
   Space 3D). Las siete filas de "Empezar" vuelven a ocupar el ancho completo,
   en una lista de una columna con más aire entre filas (8px de separación,
   filas de 64–72px en vez de 56px).
2. **Un color de dominio por icono**, no un gris monocromo uniforme: Aula en
   rosa (`--sc-color-aula`), Plantilla en el azul de acento, Biblioteca en
   púrpura, Space 3D en cian/teal — todos como mezcla suave (14–16%) sobre la
   superficie, nunca relleno pleno. El pleno de color sigue siendo exclusivo de
   "Nuevo proyecto", la única acción primaria. La flecha de cada fila también se
   tiñe de ese mismo color al pasar el cursor (vía `--launcher-accent`, que
   `02-welcome.css` ya sabía leer).
3. **Profundidad real en vez de aplanado total**: cada fila tiene sombra en
   reposo y se eleva 1px con más sombra al pasar el cursor (antes: sin sombra,
   solo un tinte de fondo). Los dos destinos de archivo (Importar / DXF)
   recuperan el trazo discontinuo que los marcaba como zona de soltar un
   archivo — dentro de `.welcome-action-list` ese trazo se había aplanado sin
   querer a un borde sólido transparente.
4. **Buscador con más presencia**: la píldora del campo ahora lleva sombra
   propia y un anillo de foco más visible, y la banda ya no es una franja gris
   encajonada entre dos blancos — usa el mismo fondo que el resto de la
   ventana.
5. **Tarjeta "Continuar proyecto"** con un tinte de acento muy suave en
   degradado (en vez de superficie plana) y más elevación al pasar el cursor.
6. Columnas con más `padding`/`gap` en general, acorde a filas más altas.

## Por qué

Feedback directo del usuario tras ver la primera versión ("quedó muy feo, sé
libre, mejóralo"). El diagnóstico: el mosaico de dos columnas comprimía el
texto, y el "un solo acento en toda la pantalla" (documentado como "decisión 2
del sistema" en la versión anterior de este archivo) sumado a "sin elevación,
solo tinte" ("decisión 4") dejaba una lista de siete filas grises,
indistinguibles entre sí salvo por texto — leía como aplanada y sin vida antes
que como sobria. Con permiso explícito del usuario para apartarme de esas dos
reglas, se optó por color por dominio (suave, no saturado) y sombra real, que
es un patrón común en lanzadores de aplicación (macOS System Settings, Linear,
Notion) y aquí resuelve el problema concreto que se reportó.

## Archivos tocados

- `src/styles/29-welcome.css` — reescritura de la sección de `.welcome-action-list`
  (vuelta a una columna, color por icono, elevación real, trazo discontinuo en
  import), pulido del buscador y de la tarjeta "Continuar proyecto", ajuste de
  `padding`/`gap` de columna.

No hubo cambios de JSX ni de tests en esta pasada: el DOM y las clases que
`welcomeFlow.test.tsx` y `ProjectHub.test.tsx` verifican no se tocaron.

## Cómo verificar

```bash
npx vitest run src/features/welcome src/features/project-hub src/i18n src/App.test.tsx
npx tsc -b --noEmit
npx oxlint src/styles src/features/welcome
```

Visualmente: `npm run dev`, abrir `/`, comparar claro/oscuro y probar el
buscador. Verificado con capturas de Playwright (escritorio 1280×900, móvil
390×844, claro y oscuro, con y sin filtro activo) contra el servidor de
desarrollo local — sin regresiones de layout ni de contraste encontradas.

## Pendiente / siguiente paso

Nada pendiente. El commit anterior de esta rama (buscador + CTA primario)
queda vigente; este es un ajuste puramente visual sobre esa misma base, sin
pushear todavía — igual que el anterior, a la espera de confirmación del
usuario para subir la rama.
