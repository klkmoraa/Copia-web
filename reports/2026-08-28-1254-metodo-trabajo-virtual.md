# Reporte de entrega: métodos de resolución — Trabajo Virtual (carga unitaria)

**Clasificación:** `AUDIT/TEMPORARY`
**Rama:** `claude/next-analysis-method-4f2j07`
**Commits:** ver el commit que acompaña este reporte

---

## 1. Qué se pidió

Seguir con el siguiente método de la lista tras el Teorema de los Tres Momentos
(`reports/2026-08-28-0654-metodo-tres-momentos.md`).

## 2. Por qué éste: el primer método que no es viga ni pórtico

Las cuatro entregas anteriores —Doble Integración, Portal, Voladizo, Tres Momentos— narran vigas
o pórticos. `structureClassification.ts` reconoce una tercera familia desde el principio,
`'truss'`, y hasta ahora ningún método la ofrecía: Doble Integración y Tres Momentos se retiran
explícitamente ante una armadura (`method.rejectedNotBeam`), y Portal/Voladizo nunca la
clasificarían como `'frame'`. El Método del Trabajo Virtual (carga unitaria) es el primero que
trabaja sobre esa familia.

El principio: para hallar el desplazamiento de un nudo de una armadura determinada, se retira la
carga real, se aplica una única carga virtual unitaria en ese nudo y en la dirección de interés, y
se halla la fuerza que esa carga virtual produce en cada barra. El desplazamiento es

```
Δ = Σ (nᵢ Nᵢ Lᵢ) / (Aᵢ Eᵢ)
```

sumado sobre toda la armadura — `Nᵢ` la fuerza axial real de la barra bajo las cargas reales, `nᵢ`
su fuerza axial bajo la única carga virtual, `Lᵢ` su longitud. Tanto `Nᵢ` como `nᵢ` salen
directamente de `analyzeProject` — la real, del análisis que ya trae el resto del informe; la
virtual, de un modelo de una sola carga, exactamente como los modelos de carga unitaria que
`doubleIntegration.ts` construye para sus propias redundantes. Nada aquí re-deriva la estática de
la armadura: se lee la fuerza axial que el solver ya calculó y se suma.

**Es exacto, como Doble Integración y Tres Momentos**: tiene que coincidir con el desplazamiento
que reporta el análisis matricial en ese mismo grado de libertad. El informe narra el
desplazamiento de **todos** los nudos con al menos un grado de libertad genuinamente sin
restringir, no sólo uno, y desarrolla barra por barra el de mayor magnitud como ejemplo completo.

## 3. La arquitectura

| Módulo nuevo | Qué hace |
|---|---|
| `src/analysis-methods/virtualWork.ts` | El método. No necesitó ningún módulo de geometría nuevo: la armadura ya es un grafo de barras, no una retícula que extraer. |

`solveVirtualWork` no re-deriva la estática de la armadura: cada fuerza (real o virtual) sale de
`analyzeProject`. **`src/engine/**` queda byte a byte idéntico.**

Alcance de esta entrega:

- Sólo cargas nodales — una carga de miembro activa (p. ej. peso propio distribuido a lo largo de
  una barra) rompe el supuesto de axial constante por barra que la suma `Σ nNL/AE` necesita, y se
  retira (`method.rejectedMemberLoadOnTruss`) en vez de aproximarlo.
- Un apoyo oblicuo (rodillo con ángulo no alineado a los ejes) no deja claro si `ux` o `uy` es
  realmente el grado libre; ese nudo simplemente no aparece en la tabla, en vez de reclamar un eje
  equivocado.

## 4. Frontera protegida (mismo patrón ya autorizado)

`solutionMethod` gana un sexto valor, `'virtual-work'`, en `src/types.ts` y `src/data/migrate.ts`
— los mismos dos ficheros que tocaron las cuatro entregas anteriores, por la misma razón. Línea
base refrescada con `--update`; el gate confirmó que sólo esos dos ficheros cambiaron dentro de la
frontera. **Ninguna matemática del solver cambió.**

## 5. Verificación ejecutada

`npm run verify` completo, en verde (ver la salida del comando que acompaña este reporte).

El gate propio (`virtualWork.test.ts`):

- En la armadura triangular 3-4-5 del ejercicio original structureCo, coincide con el solver en
  los tres grados de libertad realmente sin restringir (`B.ux`, `C.ux`, `C.uy`), con una
  diferencia menor a 1e-9 m.
- El desplazamiento narrado con detalle —el de mayor magnitud, `C.uy`— desarrolla las tres barras
  y la suma de sus aportes reproduce el total exactamente.
- El método se retira ante un pórtico, una carga de miembro activa sobre una armadura, y un modelo
  sin ningún grado de libertad realmente sin restringir.

`TopBar.test.tsx` no necesitó cambios: ninguna prueba existente cubre el selector de método sobre
una armadura.

## 6. Lo que esta fase no hace

- **Cargas de miembro sobre armaduras** (peso propio) — necesitaría integrar la axial variable a
  lo largo de la barra en vez de tratarla como constante.
- **Armaduras indeterminadas** — el trabajo virtual con carga unitaria, en su forma directa,
  asume una armadura determinada; una indeterminada necesitaría combinarlo con el método de la
  flexibilidad.
- **Los métodos restantes de la lista** (Área de Momentos, Viga Conjugada, Castigliano, Hardy
  Cross, Kani, Takabeya…) — la arquitectura sigue lista para cada uno.
- `npm run qa` sigue sin poder ejecutarse en este entorno (pide el canal `chrome`; falla igual en
  `origin/main`), así que no cuenta como verificación de esta fase — igual que en las cuatro
  entregas anteriores.
