# Estabilización del gate de CI

**Fecha:** 2026-08-10 20:33
**Agente:** Codex
**Rama:** `main`
**Versión verificada:** `structureco@0.8.2`
**HEAD de partida:** `043443a576ed0507a864735cb88880cd1da51935`

## Qué cambió

Se corrigieron exclusivamente los tres frentes que bloqueaban el gate:

1. Los outputs reales de OpenSees y PyNite dejaron de quedar ocultos por `.gitignore` y se incorporaron al corpus versionable de Space 3D.
2. La prueba del Inspector espera la publicación asíncrona real de `executeProjectCommand` antes de comprobar el preset visible y los valores almacenados, tanto para material como para sección.
3. Se actualizaron únicamente `pdfjs-dist` y las resoluciones transitivas vulnerables de `nanoid` y `undici`, sin `--force` ni actualizaciones generales.

No se modificaron el solver, las tolerancias, los resultados, las unidades, los signos, la topología, la persistencia ni el modelo de datos. Tampoco se añadió ningún `skip`.

## Causas raíz y soluciones

### 1. Space 3D — outputs externos ausentes en checkout limpio

**Causa raíz.** La regla global `output/` de `.gitignore` coincidía con cualquier directorio de ese nombre. `git check-ignore -v` atribuyó de forma directa a `.gitignore:4` estos dos directorios:

- `validation/space3d/oracles/opensees/output/`
- `validation/space3d/oracles/pynite/output/`

Los archivos existían en el checkout de trabajo y por eso la prueba local pasaba, pero `git ls-files validation/space3d` confirmó que los 20 JSON no estaban versionados. Un worktree limpio de `043443a` reprodujo exactamente 10 fallos `ENOENT`: cinco casos de OpenSees y cinco de PyNite.

**Solución.** La regla se ancló a la raíz como `/output/`, conservando ignorado el output local de nivel superior y permitiendo versionar outputs que formen parte de un corpus. Se añadieron 20 archivos: diez outputs normalizados y sus diez crudos `*.raw.json`.

**Integridad y procedencia.** Los diez hashes SHA-256 de inputs y outputs normalizados coinciden con `validation/space3d/oracles/manifest.json`. `py -3.12 validation/space3d/run-oracles.py --check` ejecutó los motores externos reales instalados fuera del repositorio y reportó 10/10 corridas correctas con OpenSees 3.8.0 (`openseespy`) y PyNite 3.0.0. `build-manifest.py` reconstruyó el manifiesto sin producir diff.

### 2. Inspector — preset `steel-a992`

**Causa raíz.** No había pérdida de estado ni discrepancia material/UI. `MaterialPresetSelector` y `SectionPresetSelector` son controles gobernados por los valores persistidos del miembro. Sus handlers llaman `executeProjectCommand`, que carga `projectCommand` mediante `await import(...)`; el test inspeccionaba el `<select>` inmediatamente después del evento, antes de que la promesa publicara el proyecto actualizado. El valor visible volvía transitoriamente al placeholder y la aserción fallaba.

**Solución.** Se conservó intacta la implementación de producción. La prueba ahora usa `waitFor` condicionado simultáneamente al preset visible y al valor realmente almacenado. Para secciones se añadió al harness la lectura de `M1.A` y se comprueba junto con `w12x26`, cubriendo el mismo límite asíncrono sin sleeps ni aumento de timeouts.

### 3. Dependencias — vulnerabilidades high

El estado inicial de `npm audit` fue 3 high, 0 critical:

| Paquete | Advisory y rango vulnerable | Ruta | Alcance real | Corrección compatible |
| --- | --- | --- | --- | --- |
| `pdfjs-dist` 6.1.200 | `GHSA-hq66-cqwq-w95j`, ejecución de JavaScript al abrir un PDF malicioso; `>=5.6.83 <6.2.108` | dependencia directa | Runtime: `src/utils/pdfImport.ts` procesa PDFs suministrados por el usuario; también se usa en inspección editorial | `pdfjs-dist` 6.2.108, misma major y compatible con Node 24 del repo/CI |
| `nanoid` 3.3.16 | `GHSA-2v37-7h3g-55p8`, generadores personalizados pueden iterar indefinidamente con tamaño cero; `<3.3.17` | `vite → postcss → nanoid` | Desarrollo/build; no es API de producto | resolución transitiva 3.3.18 dentro de `postcss@^8.5.16` |
| `undici` 7.28.0 | high `GHSA-4cwx-7wf7-3272` y advisories moderados asociados; `7.0.0–7.28.0` | `jsdom → undici` | Desarrollo/tests; no es cliente HTTP de producto | resolución transitiva 7.29.0 dentro de `jsdom@^29.1.1` |

No se usó `npm audit fix --force`. El diff del lockfile contiene únicamente esas tres resoluciones y el rango directo de `pdfjs-dist`.

## Archivos tocados

- `.gitignore` — ancla `output/` a la raíz.
- `validation/space3d/oracles/opensees/output/*.json` — cinco outputs OpenSees y cinco crudos versionables.
- `validation/space3d/oracles/pynite/output/*.json` — cinco outputs PyNite y cinco crudos versionables.
- `src/features/inspector/Inspector.test.tsx` — espera condicionada sobre material/sección y comprobación almacenada de `A`.
- `package.json` — eleva únicamente `pdfjs-dist` a `^6.2.108`.
- `package-lock.json` — fija `pdfjs-dist` 6.2.108, `nanoid` 3.3.18 y `undici` 7.29.0.
- `reports/2026-08-10-2033-stabilizacion-gate.md` — este reporte único.

## Pruebas ejecutadas

### Reproducción inicial

- Worktree limpio de `043443a`: `oracleComparison.test.ts` → **10 fallos `ENOENT`**, 7 pass, 5 skips Frame3DD.
- `Inspector.test.tsx` → **1 fallo** (`expected '' to be 'steel-a992'`), 27 pass.
- `npm audit --json` → **3 high**, 0 critical.

### Verificaciones específicas

- Hashes manifiesto/corpus → **10/10 inputs y outputs externos coinciden**.
- `py -3.12 validation/space3d/run-oracles.py --check` → **10/10 corridas externas reales correctas**.
- `py -3.12 validation/space3d/build-manifest.py` + `git diff --exit-code -- manifest.json` → **sin diff**.
- `npx vitest run src/space3d/engine/oracleComparison.test.ts --maxWorkers=1` → **17 pass, 5 skips Frame3DD**.
- Checkout reconstruido desde el índice, sin archivos ignorados del workspace → **20 outputs presentes, 10/10 hashes correctos y 17 pass / 5 skips Frame3DD**.
- `npx vitest run src/features/inspector/Inspector.test.tsx --maxWorkers=1` → **28 pass**.
- `npx vitest run src/utils/calculationPdfEditorial.test.ts --maxWorkers=1` → **9 pass**.
- `npm audit` → **0 vulnerabilidades**.

### Gate completo

- `npm run lint` → **exit 0**.
- `npm run typecheck` → **exit 0**.
- `npm run verify:protected` → **29 archivos intactos**.
- `npm test` → dos ejecuciones paralelas locales completaron 141/143 archivos, pero agotaron el timeout de 5 s en 5 y 4 casos respectivamente. Los casos fallidos variaron entre corridas y no pertenecen a los archivos modificados.
- Reejecución aislada de los dos archivos lentos → **43/43 pass** con los timeouts originales.
- `npx vitest run --maxWorkers=1` → **143/143 archivos, 1071 pass, 8 skips**.
- `npm run build` → **build de producción correcto**; permanecen avisos no bloqueantes de chunks grandes.
- `npm run verify:perf` → **768762 bytes / 201133 gzip**, sin techo bloqueante configurado.
- `npm run verify:space3d` → **20/20 archivos, 212 pass, 5 skips**; capacidad aprobada de **150 nudos / 300 barras**, solve máximo observado 226.878 ms y residuales finitos.
- `npm run validate:ci` → **2 workflows sin problemas detectables**.
- `npm audit` final → **0 vulnerabilidades**.
- `git diff --check` → **sin errores**; sólo avisos de normalización LF/CRLF de Git en Windows.

## Estado final de npm audit

**HECHO — 0 vulnerabilidades (0 critical, 0 high, 0 moderate, 0 low).**

## Pendiente / siguiente paso

- **Pendiente de observación, no atribuible al cambio:** en este equipo la orden paralela `npm test` excede intermitentemente el timeout de 5 s por competencia entre workers. Los mismos casos pasan aislados y la suite completa pasa con un worker. No se ampliaron timeouts ni se cambió la configuración porque quedaba fuera de los tres frentes autorizados.
- Los 5 skips de Frame3DD permanecen documentados como `NOT_RUN`; no corresponden a los outputs OpenSees/PyNite corregidos en esta tarea.
- El CI remoto no se ejecutó porque el usuario prohibió `git push`.
- No hay pendientes funcionales conocidos en los tres frentes corregidos.
