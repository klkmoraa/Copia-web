# Sites — entorno de prueba claymorphism

**Fecha:** 2026-08-07 17:05
**Agente:** Codex
**Rama:** `main`

## Qué cambió

Se creó un wrapper independiente para publicar una copia de prueba del build actual de structureCo. El wrapper toma el build de `../dist`, contiene los assets del ciclo 2 y mantiene su propio archivo `.openai/hosting.json` enlazado al Site de prueba recién creado.

## Por qué

El usuario solicitó un Site adicional solo de prueba, separado del Site anterior que no está accesible con las credenciales actuales.

## Archivos tocados

- `.openai/hosting.json` — configuración nueva, todavía sin proyecto asociado.
- `package.json` — identifica el wrapper como `structureco-sites-test`.
- `public/app/**` — build estático actual de structureCo.
- `reports/2026-08-07-1705-sites-prueba-claymorphism.md` — este reporte.

## Cómo verificar

- `npm.cmd run build` prepara y compila el wrapper antes de guardar la versión de Sites.
- El wrapper compila los assets estáticos embebidos sin depender del repositorio padre, que no existe dentro del constructor remoto de Sites.

## Resultado del despliegue

- La versión 1 falló porque el constructor remoto no tiene el repositorio padre ../dist.
- La versión 2 corrigió esa dependencia, se publicó correctamente y permanece privada.
- URL de prueba: https://structureco-clay-test-20260807.crdrawin.chatgpt.site

## Pendiente / siguiente paso

- Nada pendiente para el entorno de prueba; el Site anterior no fue modificado.
