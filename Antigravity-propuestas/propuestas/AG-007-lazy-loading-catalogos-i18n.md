# AG-007

# Modulación de Catálogos i18n con Carga Diferida (Lazy Loading) para Reducción de Bundle

# En evaluación

# 2026-08-05

# Rendimiento / i18n

# Resumen ejecutivo

Propone dividir el archivo monolítico de traducciones `src/i18n/catalogs.ts` (127 KB) en archivos separados por idioma (`es.json` / `en.json`) mediante importaciones dinámicas (`import()`). Esto reducirá el tamaño del bundle JS inicial cargando únicamente el idioma activo del usuario.

# Problema

Actualmente, `src/i18n/catalogs.ts` exporta un único objeto monolítico que contiene todas las cadenas de texto en español e inglés. El navegador descarga y parsea textos en inglés incluso si el usuario navega 100% en español.

# Evidencia

- `src/i18n/catalogs.ts`: Archivo de 127 KB con diccionarios estáticos embebidos (líneas 1-1200).

# Objetivo

1. Modularizar las traducciones en archivos JSON aislados (`src/i18n/locales/es.ts` y `en.ts`).
2. Cargar dinámicamente el idioma preferido según la configuración del proyecto.
3. Reducir el bundle JavaScript inicial en $\sim 60\text{ KB}$.

# Solución propuesta

- Crear `src/i18n/locales/es.ts` y `src/i18n/locales/en.ts`.
- Actualizar `useI18n.ts` para cargar diferidamente los diccionarios con React Suspense o estado diferido.

# Complejidad

**Baja**.

# Prioridad

**Media**.

---

# PROMPT PARA CLAUDE CODE

Lee e implementa la propuesta ubicada en:

`Antigravity-propuestas/aprobadas/AG-007-lazy-loading-catalogos-i18n.md`

Valida la propuesta contra el código real antes de modificar archivos.
Divide `src/i18n/catalogs.ts` en archivos de idioma diferidos sin alterar las claves de traducción.

Ejecuta lint, tests y build (`npm run verify`).
