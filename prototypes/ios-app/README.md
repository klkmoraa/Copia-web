# StructureCo · prototipo iOS

Prototipo funcional de la app móvil de StructureCo planteada como **app nativa de
iPhone**, no como la web responsive comprimida. Vive aislado en
`prototypes/ios-app/`: no toca `src/`, no comparte `package.json` con la app real
y no ejecuta solver ni backend.

## Ejecutar

```bash
npm --prefix prototypes/ios-app install
```

```bash
npm --prefix prototypes/ios-app run dev
```

Abre `http://localhost:5199`. Para verlo como en un teléfono: DevTools →
device toolbar → iPhone 15 Pro (393 × 852). En escritorio ancho la app se
centra en una columna de 440px; en móvil ocupa la pantalla completa y respeta
`env(safe-area-inset-*)`.

Capturas de todas las pantallas (requiere el dev server arriba):

```bash
node prototypes/ios-app/scripts/screenshots.mjs
```

Deja los PNG en `prototypes/ios-app/screenshots/` y sale con código 1 si hubo
algún error de consola durante el recorrido. También verifica el arrastre y
snap de la hoja inferior, controles táctiles de 44 pt, scroll de las pantallas
largas y ausencia de desbordamiento horizontal en el workspace landscape.

## Flujo

```
Splash → Auth → [ Inicio · Proyectos · Cuenta ]
                      │          │        └─ push: Perfil / Unidades / Seguridad / Acerca de
                      │          └─ Crear proyecto (modal, 2 pasos) ─┐
                      └─ Crear proyecto ───────────────────────────┬─┘
                                                                   ▼
                                              Workspace (pantalla completa)
                                                   └─ Resultados → Tablas completas
```

La **mesa de trabajo no es una pestaña**: se presenta como pantalla dedicada a
pantalla completa al abrir o crear un proyecto, con su propia barra, su dock y
su hoja inferior. La tab bar sólo gobierna Inicio / Proyectos / Cuenta.

## Qué funciona de verdad

- Navegación completa: push/pop con animación lateral, modales que suben,
  título grande que colapsa al desplazar.
- Login simulado (dos vías: credenciales o "Continuar como demo").
- Búsqueda, filtro por tipo y ordenación en Proyectos; estado vacío con salida.
- Alta de proyecto en dos pasos que crea el proyecto, lo añade a la lista y
  abre su mesa de trabajo con la geometría de la plantilla elegida.
- Lienzo con **pan de un dedo y zoom de pinza** reales, selección de nudos y
  barras, y edición que modifica el modelo en pantalla: mover un nudo con el
  stepper, cambiar su apoyo, cambiar la sección de una barra, borrar elementos.
  Editar invalida los resultados, como debe ser.
- Hoja inferior con tres topes (compact / medium / expanded), arrastrable, con
  resistencia elástica en los extremos.
- "Analizar" con progreso, resumen primero (veredicto + 4 magnitudes máximas),
  diagramas conmutables sobre el modelo (M, V, N, deformada) y las tablas
  largas en su propia pantalla, no comprimidas en la hoja.
- Tema claro / oscuro / sistema, unidades y precisión aplicadas a los
  resultados en pantalla.
- Portrait y landscape.

## Qué es simulado

- **No hay solver.** `analyse()` en `src/lib/model.ts` genera diagramas y
  tablas con formas cerradas plausibles y una semilla por proyecto, para que
  el resumen, la tabla y el dibujo digan lo mismo. Ningún número es un cálculo.
- No hay backend, red ni persistencia: al recargar se vuelve al estado inicial.
- Las herramientas de nudo/barra/carga cambian el modo y muestran su pista,
  pero sólo "Apoyos" crea geometría (cicla el apoyo del nudo tocado).

## Identidad

Los tokens (`src/styles/tokens.css`) derivan de
`src/design-system/tokens.css` de la app real — mismo esmeralda, mismo suelo
marfil, misma arcilla — remedidos para la mano: sombras clay a la mitad de
escala, radios mayores, escala tipográfica de iOS (11 → 34 pt) con SF Pro
delante e IBM Plex Sans detrás, y todo lo táctil desde 44 pt. La marca es el
mismo trazado SVG del logotipo del proyecto.

## Estructura

```
src/
  lib/model.ts            modelo, plantillas, proyectos y resultados simulados
  components/
    Structure.tsx         dibujo del modelo (miniatura, portada y lienzo)
    Sheet.tsx             hoja inferior con topes
    Chrome.tsx            marca, nav bar, tab bar, action sheet, toast
    ProjectRow.tsx        fila de proyecto
  screens/
    Onboarding.tsx        splash + auth
    Home.tsx              dashboard
    Projects.tsx          lista, búsqueda, filtros
    CreateProject.tsx     alta en dos pasos
    Workspace.tsx         mesa de trabajo, inspector, resultados y tablas
    Account.tsx           cuenta, ajustes y subpantallas
  styles/
    tokens.css            identidad StructureCo a escala de teléfono
    app.css               componentes
```
