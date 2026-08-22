# Rediseño visual completo: de claymorphism a identidad de sistema

**Fecha:** 2026-08-22 07:15
**Agente:** Claude Code
**Rama:** `claude/complete-visual-redesign-fuzpac`

## Qué cambió

Se retiró entera la identidad de arcilla (marfil cálido, menta/esmeralda, sombras de
doble luz, radios 10/18/24/28, serif editorial) y se sustituyó por la de una aplicación
de escritorio del sistema: grises acromáticos, un solo acento azul, material translúcido
en lugar de sombra, y rellenos en lugar de cavidades. La arquitectura de tokens se
conserva —nueve capas, un rol por consumidor—; lo que cambió es cada valor, la física que
los une, la marca, el vocabulario del repositorio y los gates que lo vigilan.

## Por qué

Petición explícita del usuario: rediseñar el producto entero para que se vea distinto,
tipo Apple, sin quedar atado al brandbook anterior. El único requisito era que siguiera
funcionando.

## Archivos tocados

- `src/design-system/tokens.css` — reescrito. Paleta por apariencia, escala de radios
  0/7/12/14/18, materiales translúcidos, elevación en cuatro escalones. Se retiraron 46
  tokens sin consumidor.
- `src/design-system/material.css` — reescrito. Los seis niveles pasan de arcilla a
  material + filete de medio píxel; respaldo opaco donde no hay `backdrop-filter`.
- `src/design-system/components/ui.css` — gramática de control nueva: ningún control se
  eleva bajo el puntero, se tiñe.
- `src/design-system/fonts.css` — fuera DM Serif Display y Manrope; entra Inter variable
  como sustituto de SF Pro. Dos webfonts menos.
- `src/design-system/{tokens,material,typography}.test.ts` y `surfaceGeometry.test.ts`
  (antes `clayReconciliation.test.ts`) — los cuatro guardianes reapuntados al contrato
  nuevo.
- `src/design-system/README.md` — **nuevo**. Explica por qué el sistema es como es.
- `src/styles.css` y los 9 CSS de feature — barrido de versalitas, tracking, cuerpos por
  debajo de 10px, pesos fuera de escala y 170 radios literales; sin elevación en hover.
- `src/features/topbar/BrandMark.tsx`, `brand/logo.svg`, `public/favicon.svg` — marca
  nueva: un pórtico con sus nudos, en vez del hexágono con la ese.
- `brand/brandbook.html` — **nuevo**. Importa los tokens y los pinta en vivo.
- `qa.mjs` — los 41 checks de arcilla reapuntados al contrato nuevo.
- `AGENTS.md` — reescrito: describía otro repositorio y skills inexistentes.
- `scripts/validate-ci.mjs` — el veto general a desplegar se estrecha para permitir Pages
  sólo con acciones de primera parte de GitHub.
- `.github/workflows/pages.yml` — **nuevo**.
- Borrados: `brand/brandbook-clay.html`, `validation/cri-91/**`,
  `scripts/qa-clay-reconciliation.mjs`.

## Cómo verificar

```bash
npm run verify   # lint · docs · frontera protegida · 2236 pruebas · build · presupuesto
npm run qa       # 145 checks compuestos por el navegador
```

Ambos en verde. La frontera matemática protegida no se tocó: `verify:protected` pasa sin
refrescar la línea base. Capturas del resultado en
`reports/evidence/2026-08-22-rediseno-identidad-sistema/`.

Tres defectos reales salieron durante el trabajo y quedaron corregidos: diez fondos que
se volvieron transparentes al morir un token, tres `box-shadow: none, <anillo>` que son
CSS inválido y dejaban sin anillo de foco a sus controles, y siete objetivos táctiles por
debajo de 44px en móvil.

## Pendiente / siguiente paso

**GitHub Pages necesita dos acciones del propietario del repositorio**, ninguna de las
cuales puede hacerse desde esta sesión:

1. **Cambiar la fuente de Pages a «GitHub Actions»** en Settings → Pages. Hoy está en
   «Deploy from a branch», que sirve el repositorio con Jekyll en vez del `dist/` que
   produce Vite — por eso 26 de las últimas 30 publicaciones fallaron. Mientras la fuente
   no cambie, `pages.yml` fallará en su paso de despliegue.
2. **Llevar `pages.yml` a `main`.** GitHub sólo expone `workflow_dispatch` desde la rama
   por defecto, así que el workflow no se puede lanzar a mano hasta que esté allí.

Queda además abierta la petición del usuario de rediseñar la **disposición** de la
pantalla de inicio (no sólo su estilo): el recorrido de cuatro pasos, la duplicación de
los puntos de entrada y el espacio muerto siguen como estaban.
