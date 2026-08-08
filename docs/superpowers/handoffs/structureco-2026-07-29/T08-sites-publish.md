# T08 — Publicación privada con Sites

**Estado inicial:** `BLOCKED` por T07. **No usar Netlify ni GitHub.**

## Objetivo

Actualizar la versión privada de Sites con el build certificado por T07 y entregar un URL verificable.

## Alcance

Trabajar en el proyecto hermano `structureco-sites`. Éste copia el build validado de `structureCo` a una ruta estática y lo entrega desde Sites. No modificar motor ni UI de `structureCo` en esta tarea.

## Pasos

1. Confirmar el commit certificado y ejecutar su build limpio en `structureCo`.
2. Sincronizar ese build en `structureco-sites`, ejecutar su build y verificar que contiene `dist/server/index.js` y metadata de hosting.
3. Guardar una versión privada en Sites y desplegarla; no cambiar acceso a público sin autorización explícita del usuario.
4. Esperar estado `succeeded`, registrar URL, commit de aplicación y versión de Sites en STATUS.
5. Si la aplicación debe ser pública, detenerse y pedir aprobación explícita de acceso antes de cambiar la visibilidad.

## Criterio de aceptación

El URL de Sites sirve el build certificado y la entrega no depende de Netlify ni GitHub.
