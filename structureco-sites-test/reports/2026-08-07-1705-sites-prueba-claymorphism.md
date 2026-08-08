# Sites — entorno de prueba claymorphism

**Fecha:** 2026-08-07 17:05
**Agente:** Codex
**Rama:** `main`

## Qué cambió

Se creó un wrapper independiente para publicar una copia de prueba del build actual de structureCo. El wrapper toma el build de `../dist`, contiene los assets del ciclo 2 y mantiene su propio archivo `.openai/hosting.json` sin `project_id` para enlazarse a un Site nuevo.

## Por qué

El usuario solicitó un Site adicional solo de prueba, separado del Site anterior que no está accesible con las credenciales actuales.

## Archivos tocados

- `.openai/hosting.json` — configuración nueva, todavía sin proyecto asociado.
- `package.json` — identifica el wrapper como `structureco-sites-test`.
- `public/app/**` — build estático actual de structureCo.
- `reports/2026-08-07-1705-sites-prueba-claymorphism.md` — este reporte.

## Cómo verificar

- `npm.cmd run build` prepara y compila el wrapper antes de guardar la versión de Sites.
- El enlace de producción de prueba se registrará tras crear y desplegar el Site.

## Pendiente / siguiente paso

- Crear el Site de prueba, persistir su `project_id`, publicar el commit y desplegar la versión privada.
